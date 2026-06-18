module.exports = {
  apps: [{
    name: 'leadawaker',
    script: 'node_modules/.bin/tsx',
    // No tsx `watch`: pm2 owns the watch below. tsx's native fs.watch is
    // unreliable on the Pi's filesystem (changes were missed, needing manual
    // restarts), so we use pm2 polling-watch instead — deterministic on any FS.
    args: '--env-file=.env server/index.ts',
    cwd: '/home/gabriel/LeadAwakerApp',
    env: {
      NODE_ENV: 'development',
      PORT: 5000,
      // Session cookie covers all *.leadawaker.com subdomains so login.html
      // (sets cookie via Vercel proxy → leadawaker.com) and the React CRM
      // (calls api.leadawaker.com directly via VITE_API_URL) share the session.
      COOKIE_DOMAIN: '.leadawaker.com',
    },
    filter_env: ['CLAUDECODE', 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_AGENT_SDK_VERSION', 'CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING'],
    // Auto-reload the server when backend code changes. Only watch backend dirs
    // (client is served by Vite and hot-reloads itself). Polling because inotify
    // is flaky on the Pi; 1.5s interval keeps CPU low while feeling instant.
    watch: ['server', 'shared'],
    ignore_watch: ['node_modules', 'client', 'dist', '.git', 'logs', 'public', 'specs', 'script'],
    watch_options: { usePolling: true, interval: 1500 },
    max_memory_restart: '512M',
    restart_delay: 1000,
    max_restarts: 50,
    min_uptime: 5000
  }]
};
