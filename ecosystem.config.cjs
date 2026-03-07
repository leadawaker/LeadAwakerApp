module.exports = {
  apps: [{
    name: 'leadawaker',
    script: 'node_modules/.bin/tsx',
    args: 'watch --env-file=.env server/index.ts',
    cwd: '/home/gabriel/LeadAwakerApp',
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    watch: false,
    max_memory_restart: '512M',
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: 5000
  }]
};
