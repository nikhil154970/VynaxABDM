"""Check LabResult for actual report data and attachments."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from assistant.queries.base_queries import get_conn

conn = get_conn()

# Get LabResult data for the patient's lab order
print("=== LabResult for LAB-20260624-0002 ===")
rows = conn.execute("""
    SELECT lr.*, loi."testName" as item_test_name
    FROM "LabResult" lr
    JOIN "LabOrderItem" loi ON loi.id = lr."orderItemId"
    WHERE lr."labOrderId" = '5be2050c-865f-4d8e-9a81-ea49a1c2b67d'
""").fetchall()
for r in rows:
    d = dict(r)
    for k, v in d.items():
        if isinstance(v, (bytes, bytearray)):
            print(f"  {k}: <binary {len(v)} bytes>")
        else:
            print(f"  {k}: {v}")
    print()

# Check all LabResult columns
print("\n=== LabResult columns ===")
rows = conn.execute("""SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'LabResult' ORDER BY ordinal_position""").fetchall()
for r in rows:
    print(f"  {dict(r)['column_name']}")

# Check if any LabResult has attachmentUrl
print("\n=== LabResults with attachments ===")
rows = conn.execute("""SELECT "id", "labOrderId", "testName", "attachmentUrl" 
    FROM "LabResult" WHERE "attachmentUrl" IS NOT NULL LIMIT 5""").fetchall()
for r in rows:
    print(dict(r))

# Check if there's a separate report/file storage table
print("\n=== Tables with 'report' or 'file' in name ===")
rows = conn.execute("""SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND (table_name LIKE '%report%' OR table_name LIKE '%file%' OR table_name LIKE '%attachment%')
    ORDER BY table_name""").fetchall()
for r in rows:
    print(f"  {dict(r)['table_name']}")
