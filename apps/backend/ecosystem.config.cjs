// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path')

const cwd = __dirname
const envPath = path.join(cwd, '.env')

module.exports = {
  apps: [
    {
      name: 'shionlib-backend',
      cwd: path.join(__dirname),
      script: 'dist/main.js',
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
