require('dotenv').config();
const http = require('http');

const data = JSON.stringify({
  email: 'receptionist@gmail.com',
  password: '12345678',
  role: 'RECEPTIONIST',
});

const req = http.request(
  {
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    timeout: 8000,
  },
  (res) => {
    let b = '';
    res.on('data', (c) => (b += c));
    res.on('end', () => {
      console.log('status', res.statusCode);
      console.log('body', b);
      process.exit(res.statusCode === 200 ? 0 : 1);
    });
  }
);

req.on('timeout', () => {
  console.error('TIMEOUT - no response from backend on port 5000');
  req.destroy();
  process.exit(2);
});

req.on('error', (e) => {
  console.error('ERROR', e.message);
  process.exit(3);
});

req.write(data);
req.end();
