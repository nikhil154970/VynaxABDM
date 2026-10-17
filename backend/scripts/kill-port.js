const { execSync } = require('child_process');

const port = Number(process.argv[2] || 5000);

try {
  if (process.platform === 'win32') {
    const out = execSync(`netstat -ano | findstr ":${port}"`, { encoding: 'utf8' });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes('LISTENING')) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (pid > 0) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`[kill-port] Stopped PID ${pid} on port ${port}`);
      } catch {
        // ignore
      }
    }
    if (!pids.size) console.log(`[kill-port] No listener on port ${port}`);
  } else {
    execSync(`lsof -ti:${port} | xargs -r kill -9`, { stdio: 'inherit', shell: true });
  }
} catch {
  console.log(`[kill-port] No listener on port ${port}`);
}
