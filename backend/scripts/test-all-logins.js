require('dotenv').config();
const http = require('http');

function login(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      },
      (res) => {
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const tests = [
  ['pharmacy', { email: 'pharmacy@gmail.com', password: '12345678', role: 'PHARMACIST' }],
  ['receptionist@gmail', { email: 'receptionist@gmail.com', password: '12345678', role: 'RECEPTIONIST' }],
  ['receptionist demo', { email: 'receptionist@vyanx.local', password: 'ChangeMeNow123!', role: 'RECEPTIONIST' }],
  ['admin', { email: 'admin@vyanx.local', password: 'admin123', role: 'SUPER_ADMIN' }],
  ['nurse shivani', { email: 'shivani@gmail.com', password: '12345678', role: 'NURSE' }],
];

(async () => {
  for (const [label, body] of tests) {
    const r = await login(body);
    console.log(label, r.status, r.body.slice(0, 120));
  }
})().catch(console.error);
