import sys
sys.path.insert(0, 'Mytho_AI')
import server
c = server.app.test_client()
r = c.post('/api/query', json={'message': "What is today's pharmacy revenue?", 'language': 'english'})
print('status', r.status_code)
print(r.get_data(as_text=True))
