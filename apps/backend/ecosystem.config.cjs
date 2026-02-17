// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path')

module.exports = {
  apps: [
    {
      name: 'shionlib-backend',
      cwd: path.join(__dirname),
      script: 'dist/main.js',
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
