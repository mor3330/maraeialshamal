"""
sync.py - مزامنة Aronium POS مع Supabase
مراعي الشمال - نظام المبيعات المركزي  v2.8

الوضع الافتراضي: daemon (يشتغل إلى الأبد، يحدّث نفسه تلقائياً)
  python sync.py          → daemon (الافتراضي)
  python sync.py --once   → مزامنة واحدة ثم خروج
  python sync.py --trigger → فحص طلب واحد ثم خروج
"""

# ─── إصدار السكريبت ───────────────────────────────────────
AGENT_VERSION = "2.8"

import sqlite3, json, os, sys, shutil, logging, time, traceback, subprocess
from datetime import datetime, timezone, timedelta
from pathlib import Path
try:
    import urllib.request, urllib.error
except ImportError:
    pass

# ─── مسارات الملفات ───────────────────────────────────────
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


# ══════════════════════════════════════════════════════════
# الإعدادات
# ══════════════════════════════════════════════════════════
def load_config():
    if not CONF_FILE.exists():
        log.error("config.json غير موجود!")
        sys.exit(1)
    with open(CONF_FILE, encoding="utf-8") as f:
        cfg = json.load(f)
    for key in ["branch_id", "supabase_url", "supabase_key", "aronium_db_path"]:
        if not cfg.get(key):
            log.error(f"مفقود في config.json: {key}")
            sys.exit(1)
    return cfg


# ══════════════════════════════════════════════════════════
# last_sync
# ══════════════════════════════════════════════════════════
def get_last_sync() -> str:
    if SYNC_FILE.exists():
        ts = SYNC_FILE.read_text(encoding="utf-8").strip()
        if ts:
            return ts
    # أول تشغيل: ابدأ من بداية اليوم
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    return today.strftime("%Y-%m-%d %H:%M:%S.000000")


def save_last_sync(ts: str):
    SYNC_FILE.write_text(ts, encoding="utf-8")


# ══════════════════════════════════════════════════════════
# Supabase REST
# ══════════════════════════════════════════════════════════
def _headers(key: str) -> dict:
    return {
        "apikey":        key,
        "Authorization": f"Bearer {key}",
        "Content-Type":  "application/json",
        "Prefer":        "return=representation,resolution=merge-duplicates",
    }


def supabase_get(url: str, key: str, table: str, query: str = "") -> list:
    endpoint = f"{url}/rest/v1/{table}?{query}"
    req = urllib.request.Request(endpoint, method="GET", headers={
        "apikey": key, "Authorization": f"Bearer {key}", "Accept": "application/json"
    })
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read().decode("utf-8"))
    except Exception:
        return []


def supabase_post(url: str, key: str, table: str, data, on_conflict: str = None):
    endpoint = f"{url}/rest/v1/{table}"
    if on_conflict:
        endpoint += f"?on_conflict={on_conflict}"
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(endpoint, data=body, method="POST", headers=_headers(key))
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="ignore")
        log.error(f"HTTP {e.code} → {table}: {err[:300]}")
        raise
    except urllib.error.URLError as e:
        raise ConnectionError(f"لا يوجد اتصال: {e.reason}")


def supabase_patch(url: str, key: str, table: str, filter_str: str, data: dict):
    endpoint = f"{url}/rest/v1/{table}?{filter_str}"
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(endpoint, data=body, method="PATCH", headers=_headers(key))
    try:
        urllib.request.urlopen(req, timeout=15)
    except Exception:
        pass


def supabase_delete(url: str, key: str, table: str, filter_str: str):
    endpoint = f"{url}/rest/v1/{table}?{filter_str}"
    req = urllib.request.Request(endpoint, method="DELETE", headers={
        "apikey": key, "Authorization": f"Bearer {key}"
    })
    try:
        urllib.request.urlopen(req, timeout=15)
    except Exception:
        pass


# ══════════════════════════════════════════════════════════
# قراءة Aronium SQLite
# ══════════════════════════════════════════════════════════
def _determine_payment_type(name: str, pid: int) -> str:
    """يحدد نوع الدفع من اسمه أولاً ثم ID احتياطياً"""
    n = (name or "").strip().lower()
    if any(k in n for k in ["cash", "كاش", "نقد", "نقدا", "نقدي"]):
        return "cash"
    if any(k in n for k in ["network", "شبكة", "شبكه", "mada", "مدى", "مدي",
                              "visa", "master", "card", "بطاقة", "بطاقه", "pos"]):
        return "network"
    if any(k in n for k in ["transfer", "تحويل", "bank", "بنك"]):
        return "transfer"
    if any(k in n for k in ["deferred", "آجل", "اجل", "مؤجل", "credit", "دين"]):
        return "deferred"
    # احتياطي بالـ ID (قد يختلف بين الفروع)
    return {1: "cash", 2: "network", 3: "transfer", 4: "deferred"}.get(pid, "cash")


def fetch_sales(db_path: str, *, mode: str = "incremental",
                last_sync: str = None, date_from: str = None, date_to: str = None):
    """
    mode="incremental" → جلب كل ما بعد last_sync (DateCreated)
    mode="date_range"  → جلب بتاريخ محدد (Date)
    يرجع (sales_list, [])
    """
    tmp = BASE_DIR / "pos_tmp.db"
    try:
        shutil.copy2(db_path, tmp)
        conn = sqlite3.connect(str(tmp))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # ── بناء شرط الفلتر ─────────────────────────────
        if mode == "date_range" and date_from and date_to:
            where = "d.Date >= ? AND d.Date <= ?"
            params = [date_from, date_to + " 23:59:59"]
            log.info(f"جلب البيانات من {date_from} إلى {date_to}")
        else:
            where = "d.DateCreated > ?"
            params = [last_sync or "2000-01-01"]
            log.info(f"جلب البيانات التزايدية منذ: {last_sync}")

        # ── جلب الفواتير (كل الأنواع ذات القيمة) ────────
        # نجلب DocumentTypeId = 2 (بيع) و 4 (مرتجع)
        # نضيف أي نوع آخر موجود في الجهاز عبر OR dt.Name LIKE '%sale%'
        cur.execute(f"""
            SELECT
                d.Id                            AS doc_id,
                d.Number                        AS invoice_number,
                d.DocumentTypeId                AS doc_type_id,
                COALESCE(dt.Name, '')           AS doc_type_name,
                d.Date                          AS sale_datetime,
                d.DateCreated                   AS date_created,
                COALESCE(d.Total, 0)            AS total,
                COALESCE(d.TotalTax, 0)         AS total_tax,
                COALESCE(d.Discount, 0)         AS discount,
                COALESCE(d.CustomerId, 0)       AS customer_id,
                COALESCE(c.Name, '')            AS customer_name,
                COALESCE(u.Username, '')        AS cashier_name,
                COALESCE(u.Name, '')            AS cashier_full_name
            FROM Document d
            LEFT JOIN DocumentType dt ON d.DocumentTypeId = dt.Id
            LEFT JOIN User u          ON d.UserId = u.Id
            LEFT JOIN Customer c      ON d.CustomerId = c.Id
            WHERE (
                d.DocumentTypeId IN (2, 4)
                OR LOWER(COALESCE(dt.Name,'')) LIKE '%sale%'
                OR LOWER(COALESCE(dt.Name,'')) LIKE '%invoice%'
                OR LOWER(COALESCE(dt.Name,'')) LIKE '%return%'
                OR LOWER(COALESCE(dt.Name,'')) LIKE '%refund%'
            )
            AND {where}
            ORDER BY d.DateCreated ASC
        """, params)
        docs = [dict(r) for r in cur.fetchall()]

        if not docs:
            conn.close()
            return [], []

        doc_ids = [d["doc_id"] for d in docs]
        ph = ",".join("?" * len(doc_ids))

        # ── جلب طرق الدفع ────────────────────────────────
        cur.execute(f"""
            SELECT
                p.DocumentId        AS doc_id,
                COALESCE(pt.Name,'') AS payment_name,
                COALESCE(pt.Id, 0)  AS payment_type_id,
                COALESCE(p.Amount, 0) AS amount
            FROM Payment p
            LEFT JOIN PaymentType pt ON p.PaymentTypeId = pt.Id
            WHERE p.DocumentId IN ({ph})
        """, doc_ids)
        payments_raw = cur.fetchall()

        # ── جلب أصناف الفواتير (بدون تقريب - دقة كاملة) ─
        cur.execute(f"""
            SELECT
                di.DocumentId                             AS doc_id,
                COALESCE(pr.Name, '')                     AS product_name,
                COALESCE(pr.Code, '')                     AS product_code,
                COALESCE(pr.Description, '')              AS product_description,
                COALESCE(di.Quantity, 0)                  AS quantity,
                COALESCE(di.Price, 0)                     AS unit_price,
                COALESCE(di.Discount, 0)                  AS item_discount,
                COALESCE(di.Tax, 0)                       AS item_tax,
                COALESCE(di.Total,
                    di.Quantity * di.Price, 0)            AS total,
                COALESCE(pr.UnitName, '')                 AS unit_name
            FROM DocumentItem di
            LEFT JOIN Product pr ON di.ProductId = pr.Id
            WHERE di.DocumentId IN ({ph})
            ORDER BY di.Id ASC
        """, doc_ids)
        items_raw = cur.fetchall()
        conn.close()

        # ── بناء خرائط الدفعات والأصناف ─────────────────
        payments_map: dict = {}
        for p in payments_raw:
            pid = p[0]
            payments_map.setdefault(pid, []).append({
                "name":   p[1],
                "pid":    p[2],
                "amount": float(p[3]),
            })

        items_map: dict = {}
        for i in items_raw:
            did = i[0]
            items_map.setdefault(did, []).append({
                "product_name":        i[1],
                "product_code":        i[2],
                "product_description": i[3],
                "quantity":            float(i[4]),   # بدون تقريب
                "unit_price":          float(i[5]),   # بدون تقريب
                "item_discount":       float(i[6]),
                "item_tax":            float(i[7]),
                "total":               float(i[8]),   # بدون تقريب
                "unit_name":           i[9],
            })

        # ── تصنيف الدفع لكل فاتورة ──────────────────────
        def classify(doc_id: int):
            pmts = payments_map.get(doc_id, [])
            if not pmts:
                return "cash", 0.0, 0.0, 0.0
            types = [_determine_payment_type(p["name"], p["pid"]) for p in pmts]
            total_paid = round(sum(p["amount"] for p in pmts), 10)
            if len(pmts) == 1:
                return types[0], total_paid, 0.0, 0.0
            # دفع مختلط
            m_cash = round(sum(
                p["amount"] for p, t in zip(pmts, types) if t == "cash"
            ), 10)
            m_net = round(sum(
                p["amount"] for p, t in zip(pmts, types) if t == "network"
            ), 10)
            return "mixed", total_paid, m_cash, m_net

        # ── بناء قائمة المبيعات ──────────────────────────
        sales = []
        for doc in docs:
            method, paid, m_cash, m_net = classify(doc["doc_id"])
            dt_name_lower = (doc["doc_type_name"] or "").lower()
            is_refund = (
                "refund" in dt_name_lower or "return" in dt_name_lower
                or doc["doc_type_id"] == 4
            )
            sales.append({
                "aronium_document_id":  doc["doc_id"],
                "invoice_number":       str(doc["invoice_number"] or doc["doc_id"]),
                "document_type":        "refund" if is_refund else "sale",
                "sale_datetime":        doc["sale_datetime"],   # التاريخ + الساعة الدقيقة
                "date_created":         doc["date_created"],    # وقت إنشاء السجل
                "total":                float(doc["total"]),
                "total_tax":            float(doc["total_tax"]),
                "discount":             float(doc["discount"]),
                "cashier_name":         doc["cashier_name"],
                "customer_name":        doc["customer_name"],
                "payment_method":       method,
                "paid_amount":          paid,
                "mixed_cash_amount":    m_cash,
                "mixed_network_amount": m_net,
                "_items":               items_map.get(doc["doc_id"], []),
                "_date_created_raw":    doc["date_created"],
            })

        return sales, []

    except Exception as e:
        log.error(f"خطأ SQLite: {e}")
        raise
    finally:
        if tmp.exists():
            try:
                tmp.unlink()
            except Exception:
                pass


# ══════════════════════════════════════════════════════════
# رفع المبيعات إلى Supabase
# ══════════════════════════════════════════════════════════
def upload_sales(cfg: dict, sales: list, sync_log_id, update_last_sync: bool = False):
    if not sales:
        log.info("لا توجد فواتير جديدة")
        _log_end(cfg, sync_log_id, 0, 0, "success")
        return

    branch_id = cfg["branch_id"]
    supa_url  = cfg["supabase_url"].rstrip("/")
    supa_key  = cfg["supabase_key"]
    log.info(f"رفع {len(sales)} فاتورة...")

    newest_ts   = ""
    total_items = 0
    BATCH = 50

    for i in range(0, len(sales), BATCH):
        batch = sales[i: i + BATCH]
        rows = [{
            "branch_id":            branch_id,
            "aronium_document_id":  s["aronium_document_id"],
            "invoice_number":       s["invoice_number"],
            "document_type":        s["document_type"],
            "sale_date":            s["sale_datetime"],       # يحمل الساعة كاملة
            "date_created":         s["date_created"],
            "total":                s["total"],
            "total_tax":            s.get("total_tax", 0),
            "discount":             s.get("discount", 0),
            "paid_amount":          s["paid_amount"],
            "payment_method":       s["payment_method"],
            "mixed_cash_amount":    s.get("mixed_cash_amount", 0),
            "mixed_network_amount": s.get("mixed_network_amount", 0),
            "cashier_name":         s["cashier_name"],
            "customer_name":        s.get("customer_name", ""),
        } for s in batch]

        result = supabase_post(
            supa_url, supa_key, "sales", rows,
            on_conflict="branch_id,aronium_document_id"
        )

        # جمع IDs لرفع الأصناف
        sale_ids: dict = {}
        if result and isinstance(result, list):
            for r in result:
                sale_ids[r["aronium_document_id"]] = r["id"]

        # رفع الأصناف (أصناف تفصيلية بدقة كاملة)
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
                    "product_code":        item.get("product_code", ""),
                    "quantity":            item["quantity"],    # دقة كاملة
                    "unit_price":          item["unit_price"],  # دقة كاملة
                    "item_discount":       item.get("item_discount", 0),
                    "item_tax":            item.get("item_tax", 0),
                    "total":               item["total"],       # دقة كاملة
                    "unit_name":           item.get("unit_name", ""),
                })
            total_items += len(s.get("_items", []))

            ts = s.get("_date_created_raw", "")
            if ts and ts > newest_ts:
                newest_ts = ts

        if items_rows:
            # حذف أصناف قديمة لنفس الفواتير (ثم إعادة رفعها بدقة)
            ids_list = [str(v) for v in sale_ids.values()]
            if ids_list:
                supabase_delete(supa_url, supa_key, "sale_items",
                                f"sale_id=in.({','.join(ids_list)})")
            supabase_post(supa_url, supa_key, "sale_items", items_rows)

        log.info(f"  دفعة {i//BATCH+1}: {len(batch)} فاتورة ✓")

    if update_last_sync and newest_ts:
        save_last_sync(newest_ts)
        log.info(f"تحديث last_sync → {newest_ts}")

    log.info(f"✅ اكتمل: {len(sales)} فاتورة | {total_items} صنف")
    _log_end(cfg, sync_log_id, len(sales), total_items, "success")


# ══════════════════════════════════════════════════════════
# Sync logs
# ══════════════════════════════════════════════════════════
def _log_start(cfg: dict, note: str = "") -> int | None:
    try:
        r = supabase_post(
            cfg["supabase_url"].rstrip("/"), cfg["supabase_key"], "sync_logs",
            {"branch_id": cfg["branch_id"], "status": "running",
             "sync_start": datetime.now(timezone.utc).isoformat(),
             "agent_version": AGENT_VERSION, "error_message": note or None}
        )
        return r[0].get("id") if r else None
    except Exception:
        return None


def _log_end(cfg: dict, log_id, sales: int, items: int, status: str, error=None):
    if not log_id:
        return
    supabase_patch(
        cfg["supabase_url"].rstrip("/"), cfg["supabase_key"], "sync_logs",
        f"id=eq.{log_id}",
        {"sync_end": datetime.now(timezone.utc).isoformat(),
         "sales_count": sales, "items_count": items,
         "status": status, "error_message": str(error) if error else None}
    )


# ══════════════════════════════════════════════════════════
# المزامنة التزايدية العادية
# ══════════════════════════════════════════════════════════
def do_sync(cfg: dict, force_full_day: bool = False):
    db_path = cfg["aronium_db_path"]
    if not Path(db_path).exists():
        log.error(f"ملف Aronium غير موجود: {db_path}")
        return

    if force_full_day:
        today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        last_sync = today.strftime("%Y-%m-%d %H:%M:%S.000000")
    else:
        last_sync = get_last_sync()

    log.info(f"مزامنة | الفرع: {cfg['branch_id']} | منذ: {last_sync}")
    lid = _log_start(cfg)
    try:
        sales, _ = fetch_sales(db_path, mode="incremental", last_sync=last_sync)
        upload_sales(cfg, sales, lid, update_last_sync=(not force_full_day))
        if force_full_day and sales:
            newest = max((s.get("_date_created_raw","") for s in sales), default="")
            if newest:
                save_last_sync(newest)
    except Exception as e:
        log.error(f"خطأ في المزامنة:\n{traceback.format_exc()}")
        _log_end(cfg, lid, 0, 0, "failed", str(e))


# ══════════════════════════════════════════════════════════
# مزامنة فترة زمنية محددة
# ══════════════════════════════════════════════════════════
def do_sync_range(cfg: dict, date_from: str, date_to: str):
    db_path = cfg["aronium_db_path"]
    if not Path(db_path).exists():
        log.error(f"ملف Aronium غير موجود: {db_path}")
        return

    log.info(f"مزامنة فترة: {date_from} → {date_to}")
    lid = _log_start(cfg, note=f"range:{date_from}→{date_to}")
    try:
        sales, _ = fetch_sales(db_path, mode="date_range",
                               date_from=date_from, date_to=date_to)
        upload_sales(cfg, sales, lid, update_last_sync=False)
    except Exception as e:
        log.error(f"خطأ في مزامنة الفترة:\n{traceback.format_exc()}")
        _log_end(cfg, lid, 0, 0, "failed", str(e))


# ══════════════════════════════════════════════════════════
# استرداد البيانات الفائتة (من أي تاريخ - ولو 20 سنة)
# ══════════════════════════════════════════════════════════
def catchup_if_needed(cfg: dict):
    """
    عند بدء التشغيل: إذا last_sync من يوم سابق →
    يجلب كل البيانات من ذلك التاريخ حتى اليوم في استعلام واحد.
    يعمل بكفاءة لأي فترة (يوم أو 20 سنة).
    """
    last_str = get_last_sync()
    try:
        last_dt   = datetime.strptime(last_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        today     = datetime.now(timezone.utc)
        diff_days = (today - last_dt).days
        if diff_days < 1:
            return

        date_from = last_dt.strftime("%Y-%m-%d")
        date_to   = today.strftime("%Y-%m-%d")
        log.info(f"⚡ {diff_days} يوم/أيام فائتة ({date_from} → {date_to}) — جاري الاسترداد...")

        do_sync_range(cfg, date_from, date_to)

        # بعد الاسترداد: حدّث last_sync لليوم الحالي لمنع إعادة الاسترداد
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.000000")
        save_last_sync(now_str)
        log.info("✅ اكتمل استرداد البيانات الفائتة")

    except Exception as e:
        log.warning(f"فشل استرداد البيانات الفائتة: {e}")


# ══════════════════════════════════════════════════════════
# تسجيل Windows Startup تلقائياً
# ══════════════════════════════════════════════════════════
def register_startup():
    if sys.platform != "win32":
        return
    try:
        import winreg
        script_path = Path(__file__).resolve()
        vbs_path    = script_path.parent / "run_silent.vbs"
        cmd = f'wscript.exe "{vbs_path}"' if vbs_path.exists() \
              else f'"{sys.executable}" "{script_path}"'
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                             r"Software\Microsoft\Windows\CurrentVersion\Run",
                             0, winreg.KEY_SET_VALUE)
        winreg.SetValueEx(key, "AroniumSync", 0, winreg.REG_SZ, cmd)
        winreg.CloseKey(key)
    except Exception:
        pass


# ══════════════════════════════════════════════════════════
# التحديث التلقائي عبر Supabase
# ══════════════════════════════════════════════════════════
def check_for_updates(cfg: dict):
    """
    يفحص sync_agent في Supabase مباشرة (بدون server_url).
    إذا وجد إصدار أحدث → يحمّله ويعيد التشغيل تلقائياً.
    """
    supa_url = cfg["supabase_url"].rstrip("/")
    supa_key = cfg["supabase_key"]
    try:
        rows = supabase_get(supa_url, supa_key, "sync_agent",
                            "id=eq.main&select=version,script_content")
        if not rows:
            log.info(f"السكريبت محدّث (v{AGENT_VERSION})")
            return

        server_v   = str(rows[0].get("version") or "1.0")
        new_script = rows[0].get("script_content", "")

        if AGENT_VERSION == server_v:
            log.info(f"السكريبت محدّث (v{AGENT_VERSION})")
            return

        if not new_script or len(new_script) < 500:
            log.warning("محتوى التحديث فارغ — تجاهل")
            return

        log.info(f"🔄 تحديث: v{AGENT_VERSION} → v{server_v}")
        script_path = Path(__file__).resolve()
        shutil.copy2(script_path, script_path.with_name("sync.bak.py"))
        script_path.write_text(new_script, encoding="utf-8")
        log.info(f"✅ تم التحديث إلى v{server_v} — إعادة التشغيل...")

        flags = 0
        if sys.platform == "win32":
            flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        subprocess.Popen([sys.executable, str(script_path)],
                         cwd=str(script_path.parent), creationflags=flags)
        os._exit(0)

    except Exception as e:
        log.warning(f"فشل فحص التحديثات: {e}")


# ══════════════════════════════════════════════════════════
# sync_triggers
# ══════════════════════════════════════════════════════════
def check_triggers(cfg: dict) -> bool:
    branch_id = cfg["branch_id"]
    supa_url  = cfg["supabase_url"].rstrip("/")
    supa_key  = cfg["supabase_key"]

    triggers = supabase_get(
        supa_url, supa_key, "sync_triggers",
        f"branch_id=eq.{branch_id}&status=eq.pending&order=requested_at.asc&limit=5"
    )
    if not triggers:
        return False

    log.info(f"{len(triggers)} طلب مزامنة فوري")
    for t in triggers:
        supabase_patch(supa_url, supa_key, "sync_triggers",
                       f"id=eq.{t['id']}", {"status": "running"})

    for t in triggers:
        sync_type = t.get("sync_type") or "normal"
        date_from = t.get("date_from")
        date_to   = t.get("date_to")
        try:
            if sync_type == "force_update":
                log.info("🔄 طلب تحديث فوري...")
                check_for_updates(cfg)
            elif sync_type == "custom_date" and date_from and date_to:
                do_sync_range(cfg, date_from, date_to)
            else:
                do_sync(cfg, force_full_day=True)

            supabase_patch(supa_url, supa_key, "sync_triggers",
                           f"id=eq.{t['id']}",
                           {"status": "done",
                            "executed_at": datetime.now(timezone.utc).isoformat()})
        except Exception as e:
            log.error(f"فشل الطلب {t['id']}: {e}")
            supabase_patch(supa_url, supa_key, "sync_triggers",
                           f"id=eq.{t['id']}", {"status": "failed"})

    return True


# ══════════════════════════════════════════════════════════
# Daemon الدائم
# ══════════════════════════════════════════════════════════
def run_daemon(cfg: dict):
    log.info(f"═══ مراعي الشمال - مزامنة Aronium v{AGENT_VERSION} ═══")
    log.info(f"الفرع: {cfg.get('branch_name', cfg['branch_id'])}")

    # حفظ PID
    try:
        PID_FILE.write_text(str(os.getpid()), encoding="utf-8")
    except Exception:
        pass

    # تسجيل Windows Startup تلقائياً
    register_startup()

    # استرداد البيانات الفائتة فور البدء
    try:
        catchup_if_needed(cfg)
    except Exception:
        pass

    SYNC_INTERVAL    = 5 * 60   # مزامنة كل 5 دقائق
    TRIGGER_INTERVAL = 30       # فحص الطلبات كل 30 ثانية
    UPDATE_INTERVAL  = 10 * 60  # فحص التحديثات كل 10 دقائق

    last_sync   = 0
    last_update = 0  # يفحص فور البدء

    while True:
        try:
            now = time.time()

            # فحص التحديثات
            if now - last_update >= UPDATE_INTERVAL:
                check_for_updates(cfg)
                last_update = time.time()

            # طلبات المزامنة الفورية
            check_triggers(cfg)

            # المزامنة الدورية
            if now - last_sync >= SYNC_INTERVAL:
                do_sync(cfg)
                last_sync = time.time()

            time.sleep(TRIGGER_INTERVAL)

        except KeyboardInterrupt:
            log.info("تم الإيقاف بأمر المستخدم")
            break
        except Exception as e:
            log.error(f"خطأ في daemon: {e}")
            time.sleep(60)


# ══════════════════════════════════════════════════════════
# نقطة الدخول
# ══════════════════════════════════════════════════════════
def main():
    cfg  = load_config()
    args = sys.argv[1:]

    if "--trigger" in args:
        executed = check_triggers(cfg)
        if not executed:
            log.info("لا توجد طلبات pending")
    elif "--once" in args:
        check_triggers(cfg)
        do_sync(cfg)
    else:
        run_daemon(cfg)


if __name__ == "__main__":
    main()
