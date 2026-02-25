/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path')

const DEPLOY_DIR = process.env.DEPLOY_DIR
const ROOT = DEPLOY_DIR ? path.resolve(process.env.DEPLOY_DIR) : __dirname
const CWD = DEPLOY_DIR ? path.join(ROOT, 'current') : __dirname
const ENV_FILE = DEPLOY_DIR ? path.join(ROOT, 'shared', '.env') : path.join(__dirname, '.env')

module.exports = {
  apps: [
    {
      name: 'shionlib-og',
      cwd: CWD,
      script: 'bun',
      args: `run --env-file=${ENV_FILE} ${path.join('src', 'server.ts')}`,
      interpreter: 'none',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env_staging: {
        NODE_ENV: 'staging',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
}
