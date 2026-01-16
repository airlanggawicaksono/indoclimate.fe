module.exports = {
  apps: [{
    name: 'indoclimate-chat',
    script: 'mise',
    args: 'exec -- npm start',
    cwd: '/var/www/html/indoclimate.fe',
    instances: 1,
    autorestart: true,
    max_memory_restart: '1G',
    env: {
      PORT: 5324,
      NODE_ENV: 'production'
    }
  }]
}
