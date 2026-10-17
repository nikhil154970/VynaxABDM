require('dotenv').config();
const http = require('http');

function login(email) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email, password: '12345678', role: 'RECEPTIONIST' });
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        timeout: 10000,
      },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(token, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  for (const email of ['vishal@gmail.com', 'receptionist@gmail.com']) {
    const loginRes = await login(email);
    const token = JSON.parse(loginRes.body).accessToken;
    const can = await get(token, '/api/receptionist/ipd/can-assign-nurse');
    console.log(email, 'can-assign', can.status, can.body.slice(0, 120));
  }
})().catch(console.error);
