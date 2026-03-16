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
    filter_env: ['CLAUDECODE', 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', 'CLAUDE_CODE_ENTRYPOINT', 'CLAUDE_AGENT_SDK_VERSION', 'CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING'],
    watch: false,
    max_memory_restart: '512M',
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: 5000
  }]
};
