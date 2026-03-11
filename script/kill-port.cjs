const { execSync } = require('child_process');
try {
  const result = execSync("grep -r 'node' /proc/*/cmdline 2>/dev/null || true", { encoding: 'utf8' });
} catch(e) {}

// Try to find PIDs listening on port 5000
try {
  const fs = require('fs');
  const dirs = fs.readdirSync('/proc').filter(d => /^\d+$/.test(d));
  for (const pid of dirs) {
    try {
      const fd = fs.readdirSync(`/proc/${pid}/fd`);
      const cmdline = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8');
      if (cmdline.includes('tsx') && cmdline.includes('server')) {
        console.log(`Killing PID ${pid}: ${cmdline.replace(/\0/g, ' ')}`);
        process.kill(Number(pid), 'SIGTERM');
      }
    } catch(e) {}
  }
} catch(e) { console.log('Error:', e.message); }
