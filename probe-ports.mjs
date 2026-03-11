import http from 'http';

function check(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      console.log(`Port ${port}: ${res.statusCode}`);
      req.destroy();
      resolve();
    });
    req.on('error', () => {
      console.log(`Port ${port}: refused`);
      resolve();
    });
    req.setTimeout(1000, () => { req.destroy(); resolve(); });
  });
}

async function main() {
  for (const p of [5000, 5001, 5005, 3000, 8080, 4000, 4173]) {
    await check(p);
  }
}

main();
