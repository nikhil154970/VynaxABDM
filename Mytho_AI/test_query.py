import requests
r = requests.post('http://127.0.0.1:5001/api/query', json={'message':'aaj ka revenue kitna hua?','language':'hinglish'})
print(r.status_code)
print(r.text)
