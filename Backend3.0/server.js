import http from 'node:http';

import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { connectRedis } from './src/config/redis.js';
import { env } from './src/config/env.js';
import { initSocket } from './src/socket/index.js';
import { startExpirySweeper, stopExpirySweeper } from './src/jobs/expiry.job.js';

// Socket.IO needs a real http.Server to attach to, so the app is no longer listened to directly
const server = http.createServer(app);

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();

    initSocket(server);
    startExpirySweeper();

    server.listen(env.PORT, () => {
      console.log(`🚀 Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

const shutdown = (signal) => {
  console.log(`\n${signal} received — shutting down`);
  stopExpirySweeper();
  server.close(() => process.exit(0));
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

startServer();
