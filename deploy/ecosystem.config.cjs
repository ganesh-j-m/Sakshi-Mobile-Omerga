// PM2 process file for VPS deployments without Docker:
//   cd server && npm ci && npm run build && npm run db:migrate:prod
//   pm2 start ../deploy/ecosystem.config.cjs && pm2 save
module.exports = {
  apps: [
    {
      name: 'sakshi-mobile',
      cwd: __dirname + '/../server',
      script: 'dist/index.js',
      instances: 1,
      env: { NODE_ENV: 'production', SERVE_CLIENT: 'true', CLIENT_DIST_DIR: '../client/dist' },
      max_memory_restart: '400M',
    },
  ],
};
