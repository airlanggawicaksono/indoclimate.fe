module.exports = {
  apps: [
    {
      name: 'indoclimate-chat',
      script: './node_modules/next/dist/bin/next',
      args: 'start',
      exec_mode: 'fork',
      instances: 1,

      env: {
        NODE_ENV: 'production',
        PORT: 5324,
        HOST: '127.0.0.1',
      },

      out_file: '/tmp/logs/indoclimate-chat-out.log',
      error_file: '/tmp/logs/indoclimate-chat-error.log',

      autorestart: true,
      max_memory_restart: '1G',
      watch: false,
    },
  ],
};
