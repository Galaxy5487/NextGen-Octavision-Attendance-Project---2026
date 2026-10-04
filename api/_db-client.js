import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnv() {
  try {
    const envFiles = ['.env.local', '.env'];
    for (const file of envFiles) {
      const envPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const idx = trimmed.indexOf('=');
          if (idx > 0) {
            const k = trimmed.slice(0, idx).trim();
            const v = trimmed.slice(idx + 1).trim();
            if (!process.env[k]) process.env[k] = v;
          }
        }
      }
    }
  } catch {}
}

loadEnv();

const DEFAULT_SUPABASE_URL = 'https://kztsphgwobudettagemb.supabase.co';
const DEFAULT_SUPABASE_KEY = 'sb_publishable_qyzo1R4zewhnNlZ2MrVb1w_F-KLiwR5';

const DEFAULT_DB = {
  profiles: [
    {
      id: 1,
      full_name: 'Team Head',
      email: 'nextgenoctavision@gmail.com',
      password: 'Head@26',
      role: 'head',
      designation: 'Team Head',
      phone: '',
      avatar_color: '#18181b',
      active: true
    },
    {
      id: 2,
      full_name: 'Ayesha Khan',
      email: process.env.BREVO_SENDER_EMAIL || 'employee@octavision.com',
      password: 'Team@26',
      role: 'employee',
      designation: 'UI/UX Designer',
      phone: '',
      avatar_color: '#3f3f46',
      active: true
    },
    {
      id: 3,
      full_name: 'Mohammed Irbaz S',
      email: process.env.BREVO_SENDER_EMAIL || 'employee@octavision.com',
      password: 'Team@26',
      role: 'employee',
      designation: 'Software Engineer',
      phone: '',
      avatar_color: '#1e3a8a',
      active: true
    }
  ],
  attendance: [],
  tasks: [],
  leaves: [],
  calendar_overrides: [],
  announcements: [],
  warning_logs: [],
  threads: [],
  messages: [],
  notifications: [],
  profile_photos: []
};

function getPossibleDbPaths() {
  const paths = [
    path.resolve(process.cwd(), 'api', '_local_db.json'),
    path.resolve(process.cwd(), '_local_db.json'),
    path.resolve('/tmp', '_local_db.json')
  ];
  try {
    if (typeof __dirname !== 'undefined') {
      paths.push(path.resolve(__dirname, '_local_db.json'));
      paths.push(path.resolve(__dirname, '..', 'api', '_local_db.json'));
    }
  } catch {}
  return paths;
}

function readDb() {
  try {
    for (const p of getPossibleDbPaths()) {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf-8');
        if (content) {
          const parsed = JSON.parse(content);
          if (parsed && Array.isArray(parsed.profiles)) {
            if (parsed.profiles.length === 0) {
              parsed.profiles = JSON.parse(JSON.stringify(DEFAULT_DB.profiles));
            }
            return parsed;
          }
        }
      }
    }
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}

function writeDb(db) {
  try {
    for (const p of getPossibleDbPaths()) {
      try {
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(p, JSON.stringify(db, null, 2), 'utf-8');
        return;
      } catch {}
    }
  } catch (err) {
    console.error('Failed to save local db:', err);
  }
}

// --- MongoDB Atlas Connection & Query Engine ---
let mongoClientInstance = null;
let mongoDbInstance = null;
let mongoConnectingPromise = null;

export async function getMongoDb() {
  loadEnv();
  const uri = process.env.MONGODB_URI || process.env.VITE_MONGODB_URI;
  if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
    return null;
  }
  if (mongoDbInstance) return mongoDbInstance;
  if (mongoConnectingPromise) return await mongoConnectingPromise;

  mongoConnectingPromise = (async () => {
    try {
      mongoClientInstance = new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
      });
      await mongoClientInstance.connect();
      const dbName = process.env.MONGODB_DB_NAME || 'octavision_attendance';
      mongoDbInstance = mongoClientInstance.db(dbName);
      await seedMongoDbIfEmpty(mongoDbInstance);
      return mongoDbInstance;
    } catch (err) {
      console.warn('MongoDB Atlas connection unavailable, falling back to local store:', err.message);
      mongoDbInstance = null;
      return null;
    } finally {
      mongoConnectingPromise = null;
    }
  })();

  return await mongoConnectingPromise;
}

async function seedMongoDbIfEmpty(db) {
  try {
    const local = readDb();
    for (const [table, initialRows] of Object.entries(DEFAULT_DB)) {
      const coll = db.collection(table);
      const count = await coll.countDocuments();
      if (count === 0) {
        const rowsToInsert = (local[table] && local[table].length) ? local[table] : initialRows;
        if (rowsToInsert && rowsToInsert.length > 0) {
          const clean = rowsToInsert.map((r) => {
            const { _id, ...rest } = r;
            return rest;
          });
          await coll.insertMany(clean);
          console.log(`Auto-seeded collection '${table}' with ${clean.length} documents into MongoDB Atlas.`);
        }
      }
    }
  } catch (err) {
    console.error('Error seeding MongoDB Atlas:', err.message);
  }
}

class MongoQuery {
  constructor(tableName) {
    this.tableName = tableName;
    this.op = 'select';
    this.insertPayload = null;
    this.updatePayload = null;
    this.filter = {};
    this.sortOpts = null;
    this.limitVal = null;
    this.isSingle = false;
  }

  select() {
    if (this.op !== 'insert' && this.op !== 'update') this.op = 'select';
    return this;
  }
  insert(data) {
    this.op = 'insert';
    this.insertPayload = data;
    return this;
  }
  update(patch) {
    this.op = 'update';
    this.updatePayload = patch;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(col, val) {
    if (col === 'id' || col.endsWith('_id')) {
      const num = Number(val);
      if (!isNaN(num)) {
        this.filter.$or = [{ [col]: num }, { [col]: String(val) }];
      } else {
        this.filter[col] = val;
      }
    } else {
      this.filter[col] = val;
    }
    return this;
  }
  neq(col, val) {
    this.filter[col] = { $ne: val };
    return this;
  }
  gte(col, val) {
    this.filter[col] = { ...(this.filter[col] || {}), $gte: val };
    return this;
  }
  lte(col, val) {
    this.filter[col] = { ...(this.filter[col] || {}), $lte: val };
    return this;
  }
  gt(col, val) {
    this.filter[col] = { ...(this.filter[col] || {}), $gt: val };
    return this;
  }
  lt(col, val) {
    this.filter[col] = { ...(this.filter[col] || {}), $lt: val };
    return this;
  }
  in(col, vals) {
    const arr = Array.isArray(vals) ? vals : [vals];
    const expanded = [];
    arr.forEach((v) => {
      expanded.push(v);
      const num = Number(v);
      if (!isNaN(num)) expanded.push(num);
      expanded.push(String(v));
    });
    this.filter[col] = { $in: Array.from(new Set(expanded)) };
    return this;
  }
  ilike(col, pattern) {
    const pat = String(pattern || '').replace(/%/g, '');
    this.filter[col] = { $regex: pat, $options: 'i' };
    return this;
  }
  contains(col, vals) {
    const arr = Array.isArray(vals) ? vals : [vals];
    const expanded = arr.map((v) => Number(v) || v);
    this.filter[col] = { $all: expanded };
    return this;
  }
  order(col, opts = {}) {
    this.sortOpts = { [col]: opts.ascending !== false ? 1 : -1 };
    return this;
  }
  limit(n) {
    this.limitVal = n;
    return this;
  }
  single() {
    this.isSingle = true;
    return this;
  }

  async execute() {
    const db = await getMongoDb();
    if (!db) return null;
    const coll = db.collection(this.tableName);

    try {
      if (this.op === 'insert') {
        const payloads = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload];
        const maxDoc = await coll.find({}, { projection: { id: 1 } }).sort({ id: -1 }).limit(1).toArray();
        let maxId = (maxDoc.length && Number(maxDoc[0].id)) ? Number(maxDoc[0].id) : 0;

        const insertedRecords = [];
        for (const p of payloads) {
          maxId++;
          const record = { id: p.id || maxId, created_at: new Date().toISOString(), ...p };
          delete record._id;
          await coll.insertOne(record);
          const { _id, ...clean } = record;
          insertedRecords.push(clean);
        }
        const res = Array.isArray(this.insertPayload) ? insertedRecords : insertedRecords[0];
        return { data: this.isSingle ? (insertedRecords[0] || null) : res, error: null };
      }

      if (this.op === 'update') {
        const updateDoc = { $set: { ...this.updatePayload } };
        delete updateDoc.$set._id;
        await coll.updateMany(this.filter, updateDoc);
        let updatedDocs = await coll.find(this.filter).toArray();
        updatedDocs = updatedDocs.map(({ _id, ...r }) => r);
        return { data: this.isSingle ? (updatedDocs[0] || null) : updatedDocs, error: null };
      }

      if (this.op === 'delete') {
        let deletedDocs = await coll.find(this.filter).toArray();
        deletedDocs = deletedDocs.map(({ _id, ...r }) => r);
        await coll.deleteMany(this.filter);
        return { data: deletedDocs, error: null };
      }

      // select
      let cursor = coll.find(this.filter);
      if (this.sortOpts) cursor = cursor.sort(this.sortOpts);
      if (this.limitVal != null) cursor = cursor.limit(this.limitVal);
      let docs = await cursor.toArray();
      docs = docs.map(({ _id, ...r }) => r);

      if (this.isSingle) {
        return { data: docs[0] || null, error: docs[0] ? null : { message: 'Row not found', code: 'PGRST116' } };
      }
      return { data: docs, error: null };
    } catch (err) {
      console.error(`MongoQuery error on table ${this.tableName}:`, err.message);
      return { data: null, error: { message: err.message } };
    }
  }
}

// --- Local Memory/JSON Query engine ---
class LocalQuery {
  constructor(table) {
    this.tableName = table;
    this.op = 'select';
    this.insertPayload = null;
    this.updatePayload = null;
    this.filters = [];
    this.orderOpts = null;
    this.limitVal = null;
    this.isSingle = false;
  }

  select() {
    if (this.op !== 'insert' && this.op !== 'update') this.op = 'select';
    return this;
  }
  insert(data) {
    this.op = 'insert';
    this.insertPayload = data;
    return this;
  }
  update(patch) {
    this.op = 'update';
    this.updatePayload = patch;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(col, val) {
    this.filters.push((row) => row && row[col] == val);
    return this;
  }
  neq(col, val) {
    this.filters.push((row) => row && row[col] != val);
    return this;
  }
  gte(col, val) {
    this.filters.push((row) => row && row[col] >= val);
    return this;
  }
  lte(col, val) {
    this.filters.push((row) => row && row[col] <= val);
    return this;
  }
  gt(col, val) {
    this.filters.push((row) => row && row[col] > val);
    return this;
  }
  lt(col, val) {
    this.filters.push((row) => row && row[col] < val);
    return this;
  }
  in(col, vals) {
    const set = new Set((vals || []).map(String));
    this.filters.push((row) => row && set.has(String(row[col])));
    return this;
  }
  ilike(col, pattern) {
    const pat = String(pattern || '').replace(/%/g, '').toLowerCase();
    this.filters.push((row) => row && String(row[col] || '').toLowerCase().includes(pat));
    return this;
  }
  contains(col, vals) {
    const arr = Array.isArray(vals) ? vals : [vals];
    this.filters.push((row) => {
      if (!row || !row[col]) return false;
      const rowArr = (Array.isArray(row[col]) ? row[col] : [row[col]]).map(Number);
      return arr.every((v) => rowArr.includes(Number(v)));
    });
    return this;
  }
  order(col, opts = {}) {
    this.orderOpts = { col, ascending: opts.ascending !== false };
    return this;
  }
  limit(n) {
    this.limitVal = n;
    return this;
  }
  single() {
    this.isSingle = true;
    return this;
  }

  async execute() {
    const db = readDb();
    if (!db[this.tableName]) db[this.tableName] = [];
    let rows = db[this.tableName];

    if (this.op === 'insert') {
      const payloads = Array.isArray(this.insertPayload) ? this.insertPayload : [this.insertPayload];
      const inserted = [];
      for (const p of payloads) {
        const nextId = rows.length ? Math.max(...rows.map((r) => Number(r.id) || 0)) + 1 : 1;
        const record = { id: nextId, created_at: new Date().toISOString(), ...p };
        rows.push(record);
        inserted.push(record);
      }
      writeDb(db);
      const res = Array.isArray(this.insertPayload) ? inserted : inserted[0];
      return { data: this.isSingle ? (inserted[0] || null) : res, error: null };
    }

    if (this.op === 'update') {
      let matches = rows;
      for (const f of this.filters) {
        matches = matches.filter(f);
      }
      const updated = [];
      for (const r of matches) {
        Object.assign(r, this.updatePayload);
        updated.push(r);
      }
      writeDb(db);
      return { data: this.isSingle ? (updated[0] || null) : updated, error: null };
    }

    if (this.op === 'delete') {
      let remaining = [];
      let deleted = [];
      for (const r of rows) {
        let match = true;
        for (const f of this.filters) {
          if (!f(r)) { match = false; break; }
        }
        if (match) deleted.push(r);
        else remaining.push(r);
      }
      db[this.tableName] = remaining;
      writeDb(db);
      return { data: deleted, error: null };
    }

    // select
    let res = [...rows];
    for (const f of this.filters) {
      res = res.filter(f);
    }
    if (this.orderOpts) {
      const { col, ascending } = this.orderOpts;
      res.sort((a, b) => {
        if (a[col] < b[col]) return ascending ? -1 : 1;
        if (a[col] > b[col]) return ascending ? 1 : -1;
        return 0;
      });
    }
    if (this.limitVal != null) {
      res = res.slice(0, this.limitVal);
    }
    if (this.isSingle) {
      return { data: res[0] || null, error: res[0] ? null : { message: 'Row not found', code: 'PGRST116' } };
    }
    return { data: res, error: null };
  }
}

function createProxyChain(table, realBuilder) {
  const local = new LocalQuery(table);
  const mongo = new MongoQuery(table);

  const proxy = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'then') {
        return (onfulfilled, onrejected) => {
          (async () => {
            // Priority 1: MongoDB Atlas
            const mongoRes = await mongo.execute();
            if (mongoRes !== null) {
              return mongoRes;
            }
            // Priority 2: Real Supabase (if configured and working)
            if (realBuilder && typeof realBuilder.then === 'function') {
              try {
                const result = await realBuilder;
                if (!result.error) return result;
              } catch (e) {}
            }
            // Priority 3: Local JSON Store
            return await local.execute();
          })().then(onfulfilled, onrejected);
        };
      }

      if (prop === 'catch') {
        return (onrejected) => {
          (async () => {
            const mongoRes = await mongo.execute();
            if (mongoRes !== null) return mongoRes;
            if (realBuilder && typeof realBuilder.catch === 'function') {
              try {
                const result = await realBuilder;
                if (!result.error) return result;
              } catch (e) {}
            }
            return await local.execute();
          })().catch(onrejected);
        };
      }

      return (...args) => {
        if (typeof mongo[prop] === 'function') {
          mongo[prop](...args);
        }
        if (typeof local[prop] === 'function') {
          local[prop](...args);
        }
        let nextReal = null;
        if (realBuilder && typeof realBuilder[prop] === 'function') {
          try {
            nextReal = realBuilder[prop](...args);
          } catch {}
        }
        return createProxyChain(table, nextReal);
      };
    },
  });

  return proxy;
}

let clientInstance = null;

function getClient() {
  if (!clientInstance) {
    loadEnv();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY;

    try {
      clientInstance = createClient(url, key);
    } catch {}
  }
  return clientInstance;
}

const supabase = {
  from(table) {
    let realBuilder = null;
    try {
      const client = getClient();
      if (client) realBuilder = client.from(table);
    } catch {}
    return createProxyChain(table, realBuilder);
  },
};

export { supabase };
export default supabase;
