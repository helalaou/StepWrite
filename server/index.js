import express from 'express';
import cors from 'cors';
import config from './config.js';

const app = express();
const port = config.server.port;

app.use(cors({
  origin: `http://localhost:${config.client.port}`,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.get('/test', (req, res) => {
  console.log('Test route hit');
  res.json({ message: 'Server is working' });
});

app.listen(port, () => {
  console.log(`${config.app.name} server v${config.app.version} running at http://localhost:${port}`);
  console.log('Registered routes:');
  app._router.stack.forEach((r) => {
    if (r.route && r.route.path) {
      console.log(r.route.path);
    }
  });
}); 