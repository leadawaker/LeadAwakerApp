module.exports = {
  apps: [{
    name: 'leadawaker',
    script: 'node_modules/.bin/tsx',
    args: 'watch --env-file=.env server/index.ts',
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
    watch: false,
    max_memory_restart: '512M',
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: 5000
  }]
};
