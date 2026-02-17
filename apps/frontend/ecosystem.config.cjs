const path = require('path')

module.exports = {
  apps: [
    {
      name: 'shionlib-frontend',
      port: 2948,
      cwd: path.join(__dirname),
      script: './.next/standalone/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_file: '.env',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
