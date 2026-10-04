import { getMongoDb } from '../api/_db-client.js';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  console.log('--- MongoDB Atlas Data Migration Tool ---');
  const db = await getMongoDb();
  if (!db) {
    console.error('ERROR: Could not connect to MongoDB Atlas.');
    console.error('Please check that MONGODB_URI in .env.local contains your valid connection string.');
    process.exit(1);
  }

  console.log(`Connected to MongoDB Atlas database: ${db.databaseName}`);
  
  const localDbPath = path.resolve(process.cwd(), 'api', '_local_db.json');
  if (!fs.existsSync(localDbPath)) {
    console.log('No local _local_db.json file found to migrate.');
    process.exit(0);
  }

  try {
    const raw = fs.readFileSync(localDbPath, 'utf-8');
    const local = JSON.parse(raw);

    for (const [table, rows] of Object.entries(local)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const coll = db.collection(table);
      const cleanRows = rows.map(({ _id, ...rest }) => rest);
      
      // Wipe and replace with latest local data
      await coll.deleteMany({});
      await coll.insertMany(cleanRows);
      console.log(`Successfully migrated ${cleanRows.length} documents into collection '${table}'.`);
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  }
}

runMigration();
