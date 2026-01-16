module.exports = {
  apps: [{
    name: 'indoclimate-chat',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p ' + (process.env.PORT || 5324),
    cwd: '/app',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 5324
    }
  }]
}
