#!/usr/bin/env node
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.ASSETS_SERVER_PORT || 4000);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.resolve(PROJECT_ROOT, 'public');
const ARTWORK_ROOT = path.resolve(PUBLIC_DIR, 'artwork');

function ensureDirSync(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

ensureDirSync(ARTWORK_ROOT);

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const orgId = (req.body.orgId || 'local').toString();
    const quoteItemId = (req.body.quoteItemId || 'unknown').toString();
    const category = (req.body.category || 'customer_art').toString();
    const dest = path.join(ARTWORK_ROOT, orgId, quoteItemId, category);
    ensureDirSync(dest);
    cb(null, dest);
  },
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const ext = path.extname(file.originalname || '') || '.bin';
    const base = path.basename(file.originalname || 'upload', ext);
    const safe = base.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${ts}-${safe}${ext}`);
  }
});

const upload = multer({ storage });

// Upload endpoint
app.post('/artwork/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  const orgId = (req.body.orgId || 'local').toString();
  const quoteItemId = (req.body.quoteItemId || 'unknown').toString();
  const category = (req.body.category || 'customer_art').toString();
  if (!file) return res.status(400).json({ error: 'No file' });
  const relPath = path.relative(PUBLIC_DIR, file.path).replace(/\\/g, '/');
  res.json({
    success: true,
    file: {
      file_name: file.originalname,
      file_path: relPath.replace(/^artwork\//, ''),
      file_size: file.size,
      file_type: file.mimetype || 'application/octet-stream',
      category,
      url: `/` + relPath,
      orgId,
      quoteItemId,
    }
  });
});

// List files for a quote item
app.get('/artwork/list', (req, res) => {
  const orgId = (req.query.orgId || 'local').toString();
  const quoteItemId = (req.query.quoteItemId || '').toString();
  if (!quoteItemId) return res.status(400).json({ error: 'quoteItemId required' });
  const base = path.join(ARTWORK_ROOT, orgId, quoteItemId);
  const categories = ['customer_art', 'production_files', 'proof_mockup'];
  const results = [];
  try {
    categories.forEach(cat => {
      const dir = path.join(base, cat);
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      files.forEach(name => {
        const p = path.join(dir, name);
        const stat = fs.statSync(p);
        if (stat.isFile()) {
          const rel = path.relative(PUBLIC_DIR, p).replace(/\\/g, '/');
          results.push({
            id: `${quoteItemId}-${cat}-${name}`,
            file_name: name,
            file_path: rel.replace(/^artwork\//, ''),
            file_size: stat.size,
            file_type: 'application/octet-stream',
            category: cat,
            url: '/' + rel,
            created_at: new Date(stat.mtimeMs).toISOString(),
          });
        }
      });
    });
    res.json({ success: true, files: results });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message || String(e) });
  }
});

// Delete a file by file_path relative to artwork/
app.delete('/artwork/file', (req, res) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const filePath = (body.file_path || '').toString();
      if (!filePath) return res.status(400).json({ error: 'file_path required' });
      const full = path.join(ARTWORK_ROOT, filePath);
      if (fs.existsSync(full)) fs.unlinkSync(full);
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Local assets server running at http://localhost:${PORT}`);
});


