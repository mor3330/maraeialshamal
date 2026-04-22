"""
sync.py - مزامنة Aronium POS مع Supabase
مراعي الشمال - نظام المبيعات المركزي
يُشغَّل كل 5 دقائق عبر Task Scheduler
"""

import sqlite3
import json
import os
import sys
import shutil
import logging
import traceback
from datetime import datetime, timezone
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
    """يجلب الفواتير الجديدة منذ آخر مزامنة"""
    tmp_path = BASE_DIR / "pos_tmp.db"
    try:
        shutil.copy2(db_path, tmp_path)
        conn = sqlite3.connect(str(tmp_path))
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()

        # ── استعلام الفواتير (مبيعات + مرتجعات فقط) ──
        cur.execute("""
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
            WHERE d.DocumentTypeId IN (2, 4)   -- 2=Sale, 4=Refund
              AND d.DateCreated > ?
            ORDER BY d.DateCreated ASC
        """, (last_sync,))
        docs = [dict(r) for r in cur.fetchall()]

        if not docs:
            conn.close()
            return [], []

        doc_ids = [d["doc_id"] for d in docs]

        # ── استعلام الدفعات لكل فاتورة ──
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

        # ── استعلام الأصناف ──
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

        # ── تنظيم الدفعات حسب doc_id ──
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

        # ── تنظيم الأصناف حسب doc_id ──
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

        # ── تحديد طريقة الدفع الرئيسية ──
        def classify_payment(doc_id):
            pmts = payments_map.get(doc_id, [])
            if not pmts:
                return "cash", 0.0
            # تحديد بناءً على PaymentTypeId: 1=كاش, 2=شبكة/كارد, 3=شيك/تحويل
            type_map = {1: "cash", 2: "network", 3: "transfer", 4: "deferred"}
            total_paid = sum(p["amount"] for p in pmts)
            if len(pmts) == 1:
                method_code = type_map.get(pmts[0]["payment_type_id"], "cash")
                return method_code, total_paid
            # مدفوعات مختلطة → اجعلها mixed
            return "mixed", total_paid

        # ── تجميع الفواتير النهائية ──
        sales = []
        for doc in docs:
            method, paid = classify_payment(doc["doc_id"])
            doc_type_lower = (doc["doc_type"] or "").lower()
            is_refund = "refund" in doc_type_lower or "return" in doc_type_lower or doc_type_lower == "4"
            sales.append({
                "aronium_document_id": doc["doc_id"],
                "invoice_number":      str(doc["invoice_number"] or doc["doc_id"]),
                "document_type":       "refund" if is_refund else "sale",
                "sale_date":           doc["sale_date"],
                "date_created":        doc["date_created"],
                "total":               float(doc["total"]),
                "paid_amount":         paid,
                "payment_method":      method,
                "cashier_name":        doc["cashier_name"] or "",
                "_items":              items_map.get(doc["doc_id"], []),
                "_date_created_raw":   doc["date_created"],
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


# ─── رفع البيانات إلى Supabase ────────────────────────────
def supabase_post(url, key, table, data, on_conflict=None):
    """POST إلى Supabase REST API"""
    endpoint = f"{url}/rest/v1/{table}"
    if on_conflict:
        endpoint += f"?on_conflict={on_conflict}"

    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "apikey":           key,
            "Authorization":    f"Bearer {key}",
            "Content-Type":     "application/json",
            "Prefer":           "return=representation,resolution=merge-duplicates",
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
        sys.exit(0)  # ليس خطأ كارثياً


def log_sync_start(url, key, branch_id):
    result = supabase_post(url, key, "sync_logs", {
        "branch_id":   branch_id,
        "status":      "running",
        "sync_start":  datetime.now(timezone.utc).isoformat(),
    })
    if result and isinstance(result, list):
        return result[0].get("id")
    return None


def log_sync_end(url, key, log_id, sales_count, items_count, status, error=None):
    if not log_id:
        return
    endpoint = f"{url}/rest/v1/sync_logs?id=eq.{log_id}"
    data = {
        "sync_end":    datetime.now(timezone.utc).isoformat(),
        "sales_count": sales_count,
        "items_count": items_count,
        "status":      status,
        "error_message": str(error) if error else None,
    }
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        method="PATCH",
        headers={
            "apikey":        key,
            "Authorization": f"Bearer {key}",
            "Content-Type":  "application/json",
        },
    )
    try:
        urllib.request.urlopen(req, timeout=15)
    except Exception:
        pass


# ─── الدالة الرئيسية ──────────────────────────────────────
def main():
    cfg       = load_config()
    branch_id = cfg["branch_id"]
    supa_url  = cfg["supabase_url"].rstrip("/")
    supa_key  = cfg["supabase_key"]
    db_path   = cfg["aronium_db_path"]

    if not Path(db_path).exists():
        log.error(f"ملف Aronium غير موجود: {db_path}")
        sys.exit(1)

    last_sync = get_last_sync()
    log.info(f"بدء المزامنة | الفرع: {branch_id} | آخر مزامنة: {last_sync}")

    sync_log_id = log_sync_start(supa_url, supa_key, branch_id)

    try:
        sales, _ = fetch_new_sales(db_path, last_sync)

        if not sales:
            log.info("لا توجد فواتير جديدة.")
            log_sync_end(supa_url, supa_key, sync_log_id, 0, 0, "success")
            return

        log.info(f"تم العثور على {len(sales)} فاتورة جديدة")

        # ── رفع الفواتير (دفعات 50) ──
        total_items = 0
        newest_ts   = last_sync
        BATCH = 50

        for i in range(0, len(sales), BATCH):
            batch = sales[i : i + BATCH]
            rows  = [{
                "branch_id":           branch_id,
                "aronium_document_id": s["aronium_document_id"],
                "invoice_number":      s["invoice_number"],
                "document_type":       s["document_type"],
                "sale_date":           s["sale_date"],
                "date_created":        s["date_created"],
                "total":               s["total"],
                "paid_amount":         s["paid_amount"],
                "payment_method":      s["payment_method"],
                "cashier_name":        s["cashier_name"],
            } for s in batch]

            result = supabase_post(
                supa_url, supa_key, "sales", rows,
                on_conflict="branch_id,aronium_document_id"
            )

            # ── رفع الأصناف ──
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

                # تتبع أحدث طابع زمني
                ts = s.get("_date_created_raw", "")
                if ts and ts > newest_ts:
                    newest_ts = ts

            if items_rows:
                supabase_post(supa_url, supa_key, "sale_items", items_rows)

            log.info(f"  دفعة {i//BATCH + 1}: رُفعت {len(batch)} فاتورة")

        # ── حفظ آخر طابع زمني ──
        if newest_ts != last_sync:
            save_last_sync(newest_ts)
            log.info(f"تحديث last_sync إلى: {newest_ts}")

        log.info(f"✓ اكتملت المزامنة: {len(sales)} فاتورة، {total_items} صنف")
        log_sync_end(supa_url, supa_key, sync_log_id, len(sales), total_items, "success")

    except Exception as e:
        err_msg = traceback.format_exc()
        log.error(f"خطأ غير متوقع:\n{err_msg}")
        log_sync_end(supa_url, supa_key, sync_log_id, 0, 0, "failed", str(e))
        sys.exit(1)


if __name__ == "__main__":
    main()
