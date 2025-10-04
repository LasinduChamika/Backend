// backend/server.js
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));

// Configure Postgres using environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_qJlNI6VOPCh5@ep-dark-queen-adeko0m4-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

// Ensure table exists (optional - if you ran db.sql you can skip)
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS table_snapshots (
      id SERIAL PRIMARY KEY,
      doc_name TEXT NOT NULL UNIQUE,
      snapshot JSONB NOT NULL,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
  `);
};
ensureTable().catch(console.error);

/**
 * GET /api/snapshot/:doc
 * returns { rows: [...] }
 */
app.get('/api/snapshot/:doc', async (req, res) => {
  const { doc } = req.params;
  try {
    const { rows } = await pool.query('SELECT snapshot FROM table_snapshots WHERE doc_name = $1', [doc]);
    if (rows.length === 0) {
      return res.json({ rows: [] });
    }
    return res.json(rows[0].snapshot);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

/**
 * POST /api/snapshot/:doc
 * body: { rows: [...] }
 * Upserts snapshot
 */
app.post('/api/snapshot/:doc', async (req, res) => {
  const { doc } = req.params;
  const snapshot = req.body;
  if (!snapshot || !Array.isArray(snapshot.rows)) {
    return res.status(400).json({ error: 'Invalid snapshot format. Expect { rows: [...] }' });
  }
  try {
    await pool.query(
      `
      INSERT INTO table_snapshots (doc_name, snapshot)
      VALUES ($1, $2)
      ON CONFLICT (doc_name)
      DO UPDATE SET snapshot = $2, updated_at = now()
      `,
      [doc, snapshot]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`API server listening on ${PORT}`));

