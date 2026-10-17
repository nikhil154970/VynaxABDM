"""Find where lab report PDFs are stored."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from assistant.queries.base_queries import get_conn

conn = get_conn()

# Check LabOrder columns
print("=== LabOrder columns ===")
rows = conn.execute("""SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'LabOrder' ORDER BY ordinal_position""").fetchall()
for r in rows:
    print(f"  {dict(r)['column_name']}")

# Check LabOrderItem columns
print("\n=== LabOrderItem columns ===")
rows = conn.execute("""SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'LabOrderItem' ORDER BY ordinal_position""").fetchall()
for r in rows:
    print(f"  {dict(r)['column_name']}")

# Check LabResult columns
print("\n=== LabResult columns ===")
rows = conn.execute("""SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'LabResult' ORDER BY ordinal_position""").fetchall()
for r in rows:
    print(f"  {dict(r)['column_name']}")

# Get actual lab order data
print("\n=== LabOrder data ===")
rows = conn.execute('SELECT * FROM "LabOrder" LIMIT 2').fetchall()
for r in rows:
    d = dict(r)
    # Show non-binary fields
    for k, v in d.items():
        if isinstance(v, (bytes, bytearray)):
            print(f"  {k}: <binary {len(v)} bytes>")
        else:
            print(f"  {k}: {v}")
    print()

# Check if there's a file path or URL for reports
print("\n=== LabOrder with report file info ===")
rows = conn.execute("""SELECT "id", "orderNumber", "reportStatus", "reportFile", "reportUrl", "pdfUrl", "filePath"
    FROM "LabOrder" LIMIT 2""").fetchall()
for r in rows:
    print(dict(r))
