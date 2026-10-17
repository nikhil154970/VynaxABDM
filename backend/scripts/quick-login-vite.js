const http = require('http');

const data = JSON.stringify({
  email: 'receptionist@gmail.com',
  password: '12345678',
  role: 'RECEPTIONIST',
});

const req = http.request(
  {
    hostname: 'localhost',
    port: 5173,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
    timeout: 10000,
  },
  (res) => {
    let b = '';
    res.on('data', (c) => (b += c));
    res.on('end', () => {
      console.log('via vite 5173 -> status', res.statusCode);
      console.log('body', b);
    });
  }
);

req.on('timeout', () => {
  console.error('TIMEOUT');
  req.destroy();
});
req.on('error', console.error);
req.write(data);
req.end();
