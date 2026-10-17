require('dotenv').config();
const http = require('http');

function login(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve(JSON.parse(b).accessToken));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: 'localhost', port: 5000, path, headers: { Authorization: `Bearer ${token}` } },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(b) }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const token = await login({ email: 'receptionist@gmail.com', password: '12345678', role: 'RECEPTIONIST' });
  const res = await get('/api/receptionist/recovery-transfers/pending', token);
  console.log(res.status, JSON.stringify(res.body, null, 2).slice(0, 500));
})();
