const path = require('path')

const DEPLOY_DIR = process.env.DEPLOY_DIR
const ROOT = DEPLOY_DIR ? path.resolve(process.env.DEPLOY_DIR) : __dirname
const CWD = DEPLOY_DIR ? path.join(ROOT, 'current') : __dirname
const ENV_FILE = DEPLOY_DIR ? path.join(ROOT, 'shared', '.env') : path.join(__dirname, '.env')

module.exports = {
  apps: [
    {
      name: 'shionlib-frontend',
      port: 2948,
      cwd: CWD,
      script: path.join(CWD, '.next', 'standalone', 'server.js'),
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      node_args: `--env-file=${ENV_FILE}`,
      env_staging: {
        NODE_ENV: 'staging',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
