import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS headers middleware
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Dynamic API handler routing
const apiDir = path.join(__dirname, 'api');
if (fs.existsSync(apiDir)) {
  const files = fs.readdirSync(apiDir).filter((f) => f.endsWith('.js') && !f.startsWith('_'));
  for (const file of files) {
    const routeName = file.replace('.js', '');
    const modulePath = `./api/${file}`;
    app.all(`/api/${routeName}`, async (req, res) => {
      try {
        const mod = await import(modulePath);
        const handler = mod.mainHandler || mod.default || mod.handler;
        if (typeof handler === 'function') {
          return await handler(req, res);
        }
        return res.status(500).json({ error: `Handler function not found in api/${file}` });
      } catch (err) {
        console.error(`Error in /api/${routeName}:`, err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
      }
    });
  }
}

// Serve production static frontend build from dist/
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.use((req, res, next) => {
    if (!req.path.startsWith('/api')) {
      return res.sendFile(path.join(distDir, 'index.html'));
    }
    next();
  });
}

app.listen(PORT, () => {
  console.log(`🚀 NextGen Octavision Server running on port ${PORT}`);
  console.log(`📡 Database: MongoDB Atlas Active`);
});
