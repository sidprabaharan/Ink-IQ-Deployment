#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.EXPORT_BUCKET || 'artwork';
// Resolve project root relative to this script file to avoid cwd issues
const projectRoot = path.resolve(__dirname, '..');
const DEST_ROOT = path.resolve(projectRoot, 'exports', BUCKET);
const DRY_RUN = process.argv.includes('--dry-run');
const CONCURRENCY = Number(process.env.EXPORT_CONCURRENCY || 5);

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL or VITE_SUPABASE_URL');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
}

async function listAll(prefix = '') {
  const results = [];
  const queue = [prefix];
  while (queue.length) {
    const p = queue.shift();
    const { data, error } = await supabase.storage.from(BUCKET).list(p || '', { limit: 1000 });
    if (error) throw error;
    for (const entry of data || []) {
      const child = p ? `${p}/${entry.name}` : entry.name;
      const isFile = entry && entry.metadata && typeof entry.metadata.size === 'number';
      if (isFile) {
        results.push({ path: child, size: entry.metadata.size || 0 });
      } else {
        // Likely a folder; enqueue to explore deeper
        queue.push(child);
      }
    }
  }
  return results;
}

async function downloadFile(objPath) {
  const { data, error } = await supabase.storage.from(BUCKET).download(objPath);
  if (error) throw error;
  const destPath = path.join(DEST_ROOT, objPath);
  await ensureDir(path.dirname(destPath));
  await fs.promises.writeFile(destPath, Buffer.from(await data.arrayBuffer()));
}

async function run() {
  console.log(`Listing objects from bucket '${BUCKET}'...`);
  const objects = await listAll('');
  const totalSize = objects.reduce((a, b) => a + (b.size || 0), 0);
  console.log(`Found ${objects.length} objects, total size ~${Math.round(totalSize / 1024 / 1024)} MB`);
  if (DRY_RUN) {
    console.log('Dry run complete. No files downloaded.');
    return;
  }
  console.log(`Exporting to ${DEST_ROOT} ...`);
  await ensureDir(DEST_ROOT);
  let index = 0; let failures = 0;
  const queue = objects.slice();
  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      const i = ++index;
      try {
        await downloadFile(item.path);
        if (i % 50 === 0) console.log(`Downloaded ${i}/${objects.length}...`);
      } catch (e) {
        failures++;
        console.warn(`Failed ${item.path}:`, e.message || e);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }).map(() => worker()));
  console.log(`Done. Downloaded ${objects.length - failures}/${objects.length}. Failures: ${failures}.`);
}

run().catch((e) => { console.error(e); process.exit(1); });


