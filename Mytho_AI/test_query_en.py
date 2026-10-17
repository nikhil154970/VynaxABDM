import requests
r = requests.post('http://127.0.0.1:5001/api/query', json={'message':'What is today\'s pharmacy revenue?','language':'english'})
print(r.status_code)
print(r.text)
