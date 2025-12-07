// PM2 Ecosystem Configuration for Next.js Production
// Reference: https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      name: 'indoclimate-chat',

      // Use Next.js binary directly
      script: './node_modules/next/dist/bin/next',
      args: 'start',

      // Fork mode: single instance (simple and sufficient for static/low-traffic apps)
      exec_mode: 'fork',
      instances: 1,

      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5324,
        HOST: process.env.HOST || '127.0.0.1',
      },

      // Logging configuration
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Auto-restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',

      // Memory management
      max_memory_restart: '1G',

      // Advanced features
      kill_timeout: 5000, // Time to wait for graceful shutdown
      listen_timeout: 3000, // Time to wait for app to listen

      // Watch mode (disabled in production)
      watch: false,
    },
  ],

  // Optional: PM2 Deploy configuration
  deploy: {
    production: {
      user: 'deploy',
      host: 'chat.indoclimate.id',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/indoclimate.fe.git',
      path: '/var/www/indoclimate',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
    },
  },
};
