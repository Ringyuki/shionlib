const path = require('path')

const cwd = __dirname
const envPath = path.join(cwd, '.env')

module.exports = {
  apps: [
    {
      name: 'shionlib-frontend',
      port: 2948,
      cwd: path.join(__dirname),
      script: './.next/standalone/server.js',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      node_args: `--env-file=${envPath}`,
      env_staging: {
        NODE_ENV: 'staging',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
