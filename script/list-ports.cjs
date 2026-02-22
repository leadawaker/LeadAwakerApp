const fs = require('fs');
const lines = fs.readFileSync('/proc/net/tcp', 'utf8').split('\n').slice(1);
lines.forEach(l => {
  const parts = l.trim().split(/\s+/);
  if (!parts[0]) return;
  const st = parts[3];
  if (st !== '0A') return; // 0A = LISTEN
  const addr = parts[1];
  const [ip, portHex] = addr.split(':');
  const port = parseInt(portHex, 16);
  const ipStr = ip === '00000000' ? '0.0.0.0' : ip === '0100007F' ? '127.0.0.1' : 'other:' + ip;
  console.log(ipStr + ':' + port);
});
