/**
 * Start backend without killing an already-running instance.
 * Prevents accidental server restarts when dev is launched twice.
 */
const net = require('net');
const { spawn } = require('child_process');
const path = require('path');

const PORT = Number(process.env.PORT || 5000);

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => {
      socket.end();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
    socket.setTimeout(1500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function killProcessOnPort(port) {
  return new Promise((resolve) => {
    const plat = process.platform;
    if (plat === 'win32') {
      require('child_process').exec(`netstat -ano | findstr :${port}`, (err, stdout) => {
        if (err || !stdout.trim()) return resolve();
        const pids = [...new Set(
          stdout.split('\n')
            .filter(l => l.includes('LISTENING'))
            .map(l => l.trim().split(/\s+/).pop())
            .filter(Boolean)
        )];
        for (const pid of pids) {
          try {
            process.kill(Number(pid), 'SIGTERM');
            console.log(`[server] Killed process ${pid} on port ${port}`);
          } catch { /* best effort */ }
        }
        setTimeout(resolve, 1000);
      });
    } else {
      require('child_process').exec(`lsof -ti:${port}`, (err, stdout) => {
        if (err || !stdout.trim()) return resolve();
        const pids = stdout.trim().split('\n').filter(Boolean);
        for (const pid of pids) {
          try {
            process.kill(Number(pid), 'SIGTERM');
            console.log(`[server] Killed process ${pid} on port ${port}`);
          } catch { /* best effort */ }
        }
        setTimeout(resolve, 1000);
      });
    }
  });
}

(async () => {
  const busy = await isPortListening(PORT);
  if (busy) {
    console.log(`[server] Port ${PORT} busy — killing old process...`);
    await killProcessOnPort(PORT);
    // Wait a bit for the port to be released
    await new Promise((r) => setTimeout(r, 1500));
  }

  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    stdio: 'inherit',
    env: process.env,
    cwd: path.join(__dirname, '..'),
  });

  child.on('exit', (code) => process.exit(code ?? 0));
})();
