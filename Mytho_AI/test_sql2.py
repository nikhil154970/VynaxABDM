import sys, os, re
sys.path.insert(0, r'C:\Users\Aditya Saxena\Downloads\HT-Hospital\HT-Hospital\Mytho_AI')

from assistant.queries.base_queries import _postgres_sql

test = 'SELECT id, name FROM "Patient" WHERE uhid = ?'
print("Input:", test)
print("Output:", _postgres_sql(test))
print()

test2 = 'SELECT c.id, c."createdAt" FROM "Consultation" c WHERE c."patientId" = ?'
print("Input:", test2)
print("Output:", _postgres_sql(test2))
