"""
sync.py - مزامنة Aronium POS مع Supabase
مراعي الشمال - نظام المبيعات المركزي

الوضع الافتراضي: daemon (يشتغل إلى الأبد، يحدّث نفسه تلقائياً)
  python sync.py             → وضع daemon (الافتراضي)
  python sync.py --trigger   → فحص طلب واحد فقط ثم خروج
  python sync.py --once      → مزامنة عادية one-shot
"""

# ─── إصدار السكريبت (يُحدَّث تلقائياً) ──────────────────
AGENT_VERSION = "2.3"

import sqlite3
import json
import os
import sys
import shutil
import logging
import time
import traceback
import subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import urllib.request
    import urllib.error
except ImportError:
    pass

# ─── إعداد الـ Logging ────────────────────────────────────
BASE_DIR  = Path(__file__).parent
LOG_FILE  = BASE_DIR / "sync.log"
SYNC_FILE = BASE_DIR / "last_sync.txt"
CONF_FILE = BASE_DIR / "config.json"
PID_FILE  = BASE_DIR / "sync.pid"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
log = logging.getLogger(__name__)


# ─── قراءة الإعدادات ──────────────────────────────────────
def load_config():
    if not CONF_FILE.exists():
        log.error("config.json غير موجود! انسخه وعبّاه أولاً.")
        sys.exit(1)
    with open(CONF_FILE, encoding="utf-8") as f:
        cfg = json.load(f)
    required = ["branch_id", "supabase_url", "supabase_key", "aronium_db_path"]
    for key in required:
        if not cfg.get(key):
            log.error(f"مفقود في config.json: {key}")
            sys.exit(1)
    return cfg


# ─── آخر طابع زمني للمزامنة ───────────────────────────────
def get_last_sync() -> str:
    if SYNC_FILE.exists():
        ts = SYNC_FILE.read_text(encoding="utf-8").strip()
        if ts:
            return ts
    # أول مزامنة: ابدأ من بداية اليوم الحالي
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return today.strftime("%Y-%m-%d %H:%M:%S.000000")


def save_last_sync(ts: str):
    SYNC_FILE.write_text(ts, encoding="utf-8")


# ─── استعلام Aronium SQLite ───────────────────────────────
def fetch_new_sales(db_path: str, last_sync: str):
    return _fetch_sales(db_path, filter_type="incremental", last_sync=last_sync)


def fetch_sales_by_date_range(db_path: str, date_from: str, date_to: str):
    return _fetch_sales(db_path, filter_type="date_range", date_from=date_from, date_to=date_to)


def _fetch_sales(db_path: str, filter_type: str = "incremental",
                  last_sync: str = None, date_from: str = None, date_to: str = None):
    tmp_path = BASE_DIR / "pos_tmp.db"
    try:
        shutil.copy2(db_path, tmp_path)
        conn = sqlite3.connect(str(tmp_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        if filter_type == "date_range" and date_from and date_to:
            date_to_inclusive = date_to + " 23:59:59"
            where_clause = "d.Date >= ? AND d.Date <= ?"
            params = [date_from, date_to_inclusive]
            log.info(f"مزامنة مخصصة: الفترة من {date_from} إلى {date_to}")
        else:
            where_clause = "d.DateCreated > ?"
            params = [last_sync]

        cur.execute(f"""
            SELECT
                d.Id                AS doc_id,
                d.Number            AS invoice_number,
                dt.Name             AS doc_type,
                d.Date              AS sale_date,
                d.DateCreated       AS date_created,
                COALESCE(d.Total,0) AS total,
                u.Username          AS cashier_name
            FROM Document d
            LEFT JOIN DocumentType dt ON d.DocumentTypeId = dt.Id
            LEFT JOIN User u          ON d.UserId = u.Id
            WHERE d.DocumentTypeId IN (2, 4)
              AND {where_clause}
            ORDER BY d.DateCreated ASC
        """, params)
        docs = [dict(r) for r in cur.fetchall()]

        if not docs:
            conn.close()
            return [], []

        doc_ids = [d["doc_id"] for d in docs]
        placeholders = ",".join("?" * len(doc_ids))

        cur.execute(f"""
            SELECT
                p.DocumentId      AS doc_id,
                pt.Name           AS payment_type,
                pt.Id             AS payment_type_id,
                COALESCE(p.Amount,0) AS amount
            FROM Payment p
            LEFT JOIN PaymentType pt ON p.PaymentTypeId = pt.Id
            WHERE p.DocumentId IN ({placeholders})
        """, doc_ids)
        payments_raw = cur.fetchall()

        cur.execute(f"""
            SELECT
                di.DocumentId                  AS doc_id,
                COALESCE(pr.Name, '')          AS product_name,
                COALESCE(di.Quantity, 0)       AS quantity,
                COALESCE(di.Price, 0)          AS unit_price,
                COALESCE(di.Total, di.Quantity * di.Price, 0) AS total
            FROM DocumentItem di
            LEFT JOIN Product pr ON di.ProductId = pr.Id
            WHERE di.DocumentId IN ({placeholders})
        """, doc_ids)
        items_raw = cur.fetchall()
        conn.close()

        payments_map: dict = {}
        for p in payments_raw:
            pid = p[0]
            if pid not in payments_map:
                payments_map[pid] = []
            payments_map[pid].append({
                "payment_type":    p[1] or "",
                "payment_type_id": p[2],
                "amount":          float(p[3]),
            })

        items_map: dict = {}
        for i in items_raw:
            did = i[0]
            if did not in items_map:
                items_map[did] = []
            items_map[did].append({
                "product_name": i[1],
                "quantity":     float(i[2]),
                "unit_price":   float(i[3]),
                "total":        float(i[4]),
            })

        def classify_payment(doc_id):
            pmts = payments_map.get(doc_id, [])
            if not pmts:
                return "cash", 0.0, 0.0, 0.0
            type_map = {1: "cash", 2: "network", 3: "transfer", 4: "deferred"}
            total_paid = sum(p["amount"] for p in pmts)
            if len(pmts) == 1:
                method_code = type_map.get(pmts[0]["payment_type_id"], "cash")
                return method_code, total_paid, 0.0, 0.0
            # دفع مختلط: نحسب كم كاش وكم شبكة
            mixed_cash = sum(p["amount"] for p in pmts if type_map.get(p["payment_type_id"]) == "cash")
            mixed_net  = sum(p["amount"] for p in pmts if type_map.get(p["payment_type_id"]) == "network")
            return "mixed", total_paid, mixed_cash, mixed_net

        sales = []
        for doc in docs:
            method, paid, m_cash, m_net = classify_payment(doc["doc_id"])
            doc_type_lower = (doc["doc_type"] or "").lower()
            is_refund = "refund" in doc_type_lower or "return" in doc_type_lower or doc_type_lower == "4"
            sales.append({
                "aronium_document_id":  doc["doc_id"],
                "invoice_number":       str(doc["invoice_number"] or doc["doc_id"]),
                "document_type":        "refund" if is_refund else "sale",
                "sale_date":            doc["sale_date"],
                "date_created":         doc["date_created"],
                "total":                float(doc["total"]),
                "paid_amount":          paid,
                "payment_method":       method,
                "mixed_cash_amount":    m_cash,
                "mixed_network_amount": m_net,
                "cashier_name":         doc["cashier_name"] or "",
                "_items":               items_map.get(doc["doc_id"], []),
                "_date_created_raw":    doc["date_created"],
            })

        return sales, []

    except Exception as e:
        log.error(f"خطأ في قراءة SQLite: {e}")
        if tmp_path.exists():
            tmp_path.unlink()
        raise
    finally:
        if tmp_path.exists():
            try:
                tmp_path.unlink()
            except Exception:
                pass


# ─── Supabase REST ─────────────────────────────────────────
def supabase_request(url, key, table, data, method="POST", on_conflict=None):
    endpoint = f"{url}/rest/v1/{table}"
    if on_conflict:
        endpoint += f"?on_conflict={on_conflict}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        endpoint, data=body, method=method,
        headers={
            "apikey":        key,
            "Authorization": f"Bearer {key}",
            "Content-Type":  "application/json",
            "Prefer":        "return=representation,resolution=merge-duplicates",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="ignore")
        log.error(f"HTTP {e.code} عند رفع {table}: {body_err[:300]}")
        raise
    except urllib.error.URLError as e:
        log.warning(f"لا يوجد اتصال بالإنترنت: {e.reason}")
        return None


def supabase_post(url, key, table, data, on_conflict=None):
    result = supabase_request(url, key, table, data, "POST", on_conflict)
    if result is None:
        # لا نُنهي البرنامج — نرفع استثناء يُمسكه الـ daemon ويُعيد المحاولة بعد 5 دقائق
        raise ConnectionError("لا يوجد اتصال بالإنترنت - سيُعاد المحاولة خلال 5 دقائق")
    return result


def supabase_delete(url, key, table, filter_str):
    endpoint = f"{url}/rest/v1/{table}?{filter_str}"
    req = urllib.request.Request(
        endpoint, method="DELETE",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=15)
    except Exception as e:
        log.warning(f"تحذير: خطأ في حذف {table}: {e}")


def supabase_patch(url, key, table, filter_str, data):
    endpoint = f"{url}/rest/v1/{table}?{filter_str}"
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        endpoint, data=body, method="PATCH",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        urllib.request.urlopen(req, timeout=15)
    except Exception:
        pass


def supabase_get(url, key, table, query=""):
    endpoint = f"{url}/rest/v1/{table}?{query}"
    req = urllib.request.Request(
        endpoint, method="GET",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception:
        return []


# ─── التحديث التلقائي من السيرفر ──────────────────────────
def check_for_updates(cfg):
    """
    يفحص إذا كان هناك إصدار أحدث من السكريبت على السيرفر.
    إذا وجد، يحمّله ويعيد تشغيل نفسه تلقائياً.
    """
    server_url = cfg.get("server_url", "").rstrip("/")
    if not server_url:
        return  # لم يُضبط رابط السيرفر

    try:
        req = urllib.request.Request(
            f"{server_url}/api/pos/agent-update?version={AGENT_VERSION}",
            method="GET",
            headers={
                "apikey":        cfg["supabase_key"],
                "Authorization": f"Bearer {cfg['supabase_key']}",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        if not data.get("hasUpdate"):
            log.info(f"السكريبت محدّث (v{AGENT_VERSION})")
            return

        new_version = data.get("version", "?")
        new_script  = data.get("script", "")

        if not new_script or len(new_script) < 500:
            log.warning("التحديث فارغ أو صغير جداً - تم تجاهله")
            return

        log.info(f"تحديث متاح: v{AGENT_VERSION} → v{new_version} | جاري التحديث...")

        script_path = Path(__file__).resolve()
        backup_path = script_path.with_name("sync.bak.py")

        # نسخة احتياطية تلقائية
        shutil.copy2(script_path, backup_path)

        # كتابة الإصدار الجديد
        script_path.write_text(new_script, encoding="utf-8")
        log.info(f"تم التحديث إلى v{new_version} - جاري إعادة التشغيل...")

        # إعادة تشغيل نفسنا بالإصدار الجديد
        flags = 0
        if sys.platform == "win32":
            flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        subprocess.Popen(
            [sys.executable, str(script_path)],
            cwd=str(script_path.parent),
            creationflags=flags,
        )
        os._exit(0)

    except Exception as e:
        log.warning(f"فشل فحص التحديثات: {e}")


# ─── sync_triggers: فحص وتنفيذ الطلبات الفورية ────────────
def check_and_execute_triggers(cfg):
    branch_id = cfg["branch_id"]
    supa_url  = cfg["supabase_url"].rstrip("/")
    supa_key  = cfg["supabase_key"]

    triggers = supabase_get(
        supa_url, supa_key, "sync_triggers",
        f"branch_id=eq.{branch_id}&status=eq.pending&order=requested_at.asc&limit=5"
    )

    if not triggers:
        return False

    log.info(f"وجدت {len(triggers)} طلب مزامنة!")

    for t in triggers:
        supabase_patch(supa_url, supa_key, "sync_triggers",
                       f"id=eq.{t['id']}", {"status": "running"})

    for t in triggers:
        sync_type = t.get("sync_type") or "normal"
        date_from = t.get("date_from")
        date_to   = t.get("date_to")

        try:
            if sync_type == "custom_date" and date_from and date_to:
                log.info(f"تنفيذ مزامنة مخصصة: {date_from} → {date_to}")
                do_sync_custom_date(cfg, date_from, date_to)
            else:
                log.info("تنفيذ مزامنة فورية (اليوم الكامل)")
                do_sync(cfg, force_full_day=True)

            supabase_patch(supa_url, supa_key, "sync_triggers",
                           f"id=eq.{t['id']}",
                           {"status": "done", "executed_at": datetime.now(timezone.utc).isoformat()})
        except Exception as e:
            log.error(f"فشل تنفيذ الطلب {t['id']}: {e}")
            supabase_patch(supa_url, supa_key, "sync_triggers",
                           f"id=eq.{t['id']}", {"status": "failed"})

    return True


def log_sync_start(url, key, branch_id, note=""):
    try:
        result = supabase_post(url, key, "sync_logs", {
            "branch_id":     branch_id,
            "status":        "running",
            "sync_start":    datetime.now(timezone.utc).isoformat(),
            "agent_version": AGENT_VERSION,
            "error_message": note or None,
        })
        if result and isinstance(result, list):
            return result[0].get("id")
    except ConnectionError:
        pass  # لا نتوقف إذا فشل تسجيل البدء - لعدم وجود نت
    return None


def log_sync_end(url, key, log_id, sales_count, items_count, status, error=None):
    if not log_id:
        return
    supabase_patch(url, key, "sync_logs", f"id=eq.{log_id}", {
        "sync_end":      datetime.now(timezone.utc).isoformat(),
        "sales_count":   sales_count,
        "items_count":   items_count,
        "status":        status,
        "error_message": str(error) if error else None,
    })


# ─── دالة رفع المبيعات ────────────────────────────────────
def upload_sales(cfg, sales, sync_log_id, update_last_sync=False, last_sync_ref=None):
    branch_id = cfg["branch_id"]
    supa_url  = cfg["supabase_url"].rstrip("/")
    supa_key  = cfg["supabase_key"]

    if not sales:
        log.info("لا توجد فواتير لرفعها.")
        log_sync_end(supa_url, supa_key, sync_log_id, 0, 0, "success")
        return

    log.info(f"تم العثور على {len(sales)} فاتورة")

    total_items = 0
    newest_ts   = last_sync_ref or ""
    BATCH = 50

    for i in range(0, len(sales), BATCH):
        batch = sales[i : i + BATCH]
        rows  = [{
            "branch_id":            branch_id,
            "aronium_document_id":  s["aronium_document_id"],
            "invoice_number":       s["invoice_number"],
            "document_type":        s["document_type"],
            "sale_date":            s["sale_date"],
            "date_created":         s["date_created"],
            "total":                s["total"],
            "paid_amount":          s["paid_amount"],
            "payment_method":       s["payment_method"],
            "mixed_cash_amount":    s.get("mixed_cash_amount", 0),
            "mixed_network_amount": s.get("mixed_network_amount", 0),
            "cashier_name":         s["cashier_name"],
        } for s in batch]

        result = supabase_post(
            supa_url, supa_key, "sales", rows,
            on_conflict="branch_id,aronium_document_id"
        )

        sale_ids = {}
        if result and isinstance(result, list):
            for r in result:
                sale_ids[r["aronium_document_id"]] = r["id"]

        items_rows = []
        for s in batch:
            sale_id = sale_ids.get(s["aronium_document_id"])
            if not sale_id:
                continue
            for item in s.get("_items", []):
                items_rows.append({
                    "sale_id":             sale_id,
                    "branch_id":           branch_id,
                    "aronium_document_id": s["aronium_document_id"],
                    "product_name":        item["product_name"],
                    "quantity":            item["quantity"],
                    "unit_price":          item["unit_price"],
                    "total":               item["total"],
                })
            total_items += len(s.get("_items", []))

            ts = s.get("_date_created_raw", "")
            if ts and ts > newest_ts:
                newest_ts = ts

        if items_rows:
            existing_ids = list(sale_ids.values())
            if existing_ids:
                ids_filter = "(" + ",".join(existing_ids) + ")"
                supabase_delete(supa_url, supa_key, "sale_items",
                                f"sale_id=in.{ids_filter}")
            supabase_post(supa_url, supa_key, "sale_items", items_rows)

        log.info(f"  دفعة {i//BATCH + 1}: رُفعت {len(batch)} فاتورة")

    if update_last_sync and newest_ts and newest_ts != last_sync_ref:
        save_last_sync(newest_ts)
        log.info(f"تحديث last_sync إلى: {newest_ts}")

    log.info(f"اكتملت المزامنة: {len(sales)} فاتورة، {total_items} صنف")
    log_sync_end(supa_url, supa_key, sync_log_id, len(sales), total_items, "success")


# ─── المزامنة العادية ─────────────────────────────────────
def do_sync(cfg, force_full_day=False):
    branch_id = cfg["branch_id"]
    supa_url  = cfg["supabase_url"].rstrip("/")
    supa_key  = cfg["supabase_key"]
    db_path   = cfg["aronium_db_path"]

    if not Path(db_path).exists():
        log.error(f"ملف Aronium غير موجود: {db_path}")
        return

    if force_full_day:
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        last_sync = today.strftime("%Y-%m-%d %H:%M:%S.000000")
        log.info(f"مزامنة فورية كاملة من: {last_sync}")
    else:
        last_sync = get_last_sync()

    log.info(f"بدء المزامنة | الفرع: {branch_id} | آخر مزامنة: {last_sync}")
    sync_log_id = log_sync_start(supa_url, supa_key, branch_id)

    try:
        sales, _ = fetch_new_sales(db_path, last_sync)
        upload_sales(cfg, sales, sync_log_id,
                     update_last_sync=(not force_full_day),
                     last_sync_ref=last_sync)
        if force_full_day and sales:
            newest = max((s.get("_date_created_raw","") for s in sales), default="")
            if newest and newest > last_sync:
                save_last_sync(newest)
    except Exception as e:
        err_msg = traceback.format_exc()
        log.error(f"خطأ غير متوقع:\n{err_msg}")
        log_sync_end(supa_url, supa_key, sync_log_id, 0, 0, "failed", str(e))


# ─── استرداد الأيام الفائتة تلقائياً ─────────────────────
def catchup_missed_days(cfg):
    """
    عند إعادة تشغيل السكريبت بعد انقطاع:
    إذا كانت last_sync من يوم سابق → يزامن كل الأيام الفائتة أولاً.
    """
    last_sync_str = get_last_sync()
    try:
        last_date = datetime.strptime(last_sync_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        today     = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        diff_days = (today - last_date).days

        if diff_days < 1:
            return  # لا توجد أيام فائتة

        log.info(f"⚡ اكتشف {diff_days} يوم/أيام فائتة منذ {last_sync_str[:10]} - جاري الاسترداد...")

        # نزامن يوم السابق حتى الأمس (بدون اليوم لأنه سيُزامن في الدورة العادية)
        for d in range(diff_days):
            missed_day = last_date + timedelta(days=d)
            date_str   = missed_day.strftime("%Y-%m-%d")
            log.info(f"  ← استرداد بيانات يوم: {date_str}")
            try:
                do_sync_custom_date(cfg, date_str, date_str)
            except Exception as e:
                log.error(f"  خطأ في استرداد {date_str}: {e}")

        log.info("✅ اكتمل استرداد الأيام الفائتة")

    except Exception as e:
        log.warning(f"فشل فحص الأيام الفائتة: {e}")


# ─── المزامنة المخصصة بتاريخ محدد ────────────────────────
def do_sync_custom_date(cfg, date_from: str, date_to: str):
    branch_id = cfg["branch_id"]
    supa_url  = cfg["supabase_url"].rstrip("/")
    supa_key  = cfg["supabase_key"]
    db_path   = cfg["aronium_db_path"]

    if not Path(db_path).exists():
        log.error(f"ملف Aronium غير موجود: {db_path}")
        return

    log.info(f"بدء المزامنة المخصصة | الفرع: {branch_id} | {date_from} → {date_to}")
    sync_log_id = log_sync_start(supa_url, supa_key, branch_id,
                                  note=f"مزامنة مخصصة: {date_from} → {date_to}")
    try:
        sales, _ = fetch_sales_by_date_range(db_path, date_from, date_to)
        upload_sales(cfg, sales, sync_log_id, update_last_sync=False)
    except Exception as e:
        err_msg = traceback.format_exc()
        log.error(f"خطأ في المزامنة المخصصة:\n{err_msg}")
        log_sync_end(supa_url, supa_key, sync_log_id, 0, 0, "failed", str(e))


# ─── وضع الـ Daemon الدائم ────────────────────────────────
def run_daemon(cfg):
    """يشتغل إلى الأبد: يزامن كل 5 دقائق، يفحص الطلبات كل 30 ثانية، يتحدث كل ساعتين"""
    log.info(f"وضع الخادم الدائم | v{AGENT_VERSION} | يعمل بشكل مستمر")

    # كتابة PID ليعرف الحارس أن السكريبت يعمل
    try:
        PID_FILE.write_text(str(os.getpid()), encoding="utf-8")
    except Exception:
        pass

    # ─── استرداد الأيام الفائتة عند بدء التشغيل ─────────
    # إذا كانت last_sync من يوم أمس أو قبله → زامن الأيام الفائتة أولاً
    try:
        catchup_missed_days(cfg)
    except Exception:
        pass

    REGULAR_INTERVAL  = 5 * 60    # 5 دقائق
    TRIGGER_INTERVAL  = 30        # 30 ثانية
    UPDATE_INTERVAL   = 2 * 3600  # ساعتين

    last_regular_sync = 0
    last_update_check = 0  # يفحص التحديث فور البدء

    while True:
        try:
            now = time.time()

            # فحص التحديثات التلقائية كل ساعتين
            if now - last_update_check >= UPDATE_INTERVAL:
                check_for_updates(cfg)
                last_update_check = time.time()

            # فحص طلبات المزامنة الفورية
            check_and_execute_triggers(cfg)

            # المزامنة العادية كل 5 دقائق
            if now - last_regular_sync >= REGULAR_INTERVAL:
                do_sync(cfg)
                last_regular_sync = time.time()

            time.sleep(TRIGGER_INTERVAL)

        except KeyboardInterrupt:
            log.info("توقف بأمر المستخدم")
            break
        except Exception as e:
            log.error(f"خطأ في daemon loop: {e}")
            time.sleep(60)


# ─── الدالة الرئيسية ──────────────────────────────────────
def main():
    args = sys.argv[1:]
    cfg  = load_config()

    if "--trigger" in args:
        # فحص طلب واحد فقط ثم خروج
        log.info(f"فحص طلبات المزامنة... (v{AGENT_VERSION})")
        executed = check_and_execute_triggers(cfg)
        if not executed:
            log.info("لا توجد طلبات pending")

    elif "--once" in args or "--daemon" not in args and "--trigger" not in args and len(args) > 0:
        # مزامنة عادية one-shot (للتوافق مع النسخة القديمة)
        check_and_execute_triggers(cfg)
        do_sync(cfg)

    else:
        # الوضع الافتراضي = daemon يشتغل إلى الأبد
        run_daemon(cfg)


if __name__ == "__main__":
    main()
