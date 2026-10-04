import { getMongoDb } from './_db-client.js';
import { netlifyAdapter } from './_adapter.js';

export async function mainHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const db = await getMongoDb();
    if (!db) {
      return res.status(200).json({
        status: 'Local Fallback Active',
        driver: 'Local JSON Database',
        connected: false,
        message: 'MongoDB Atlas is ready in code. Set your live connection string in .env.local (MONGODB_URI) to connect.'
      });
    }

    const collections = await db.listCollections().toArray();
    const stats = {};
    for (const c of collections) {
      const count = await db.collection(c.name).countDocuments();
      stats[c.name] = count;
    }

    return res.status(200).json({
      status: 'MongoDB Atlas Connected & Operating at Maximum Performance',
      driver: 'MongoDB Atlas',
      connected: true,
      database: db.databaseName,
      collections: stats,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default netlifyAdapter(mainHandler);
export const handler = netlifyAdapter(mainHandler);
