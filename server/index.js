const app = require('./app');
const config = require('./config/config');

const PORT = config.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server is running on ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});
