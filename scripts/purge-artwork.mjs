#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.PURGE_BUCKET || 'artwork';
const DRY_RUN = process.argv.includes('--dry-run');
const PURGE_DB = process.argv.includes('--purge-db');
const CONCURRENCY = Number(process.env.PURGE_CONCURRENCY || 5);

if (!SUPABASE_URL) {
  console.error('Missing SUPABASE_URL or VITE_SUPABASE_URL');
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

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
        results.push(child);
      } else {
        queue.push(child);
      }
    }
  }
  return results;
}

async function removeBatch(paths) {
  const { data, error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) throw error;
  return data;
}

async function purgeDbTable() {
  try {
    // Delete all rows by comparing against a valid UUID that won't exist
    const { error } = await supabase
      .from('artwork_files')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    console.log('Deleted all rows from public.artwork_files');
  } catch (e) {
    console.warn('Failed to delete artwork_files rows:', e.message || e);
  }
}

async function run() {
  console.log(`Listing objects in bucket '${BUCKET}' ...`);
  const objects = await listAll('');
  console.log(`Found ${objects.length} objects`);
  if (DRY_RUN) {
    console.log('Dry run complete. No deletions performed.');
    return;
  }
  if (objects.length === 0) {
    console.log('Bucket already empty.');
  } else {
    let idx = 0; let failures = 0;
    const queue = objects.slice();
    async function worker() {
      while (queue.length) {
        const batch = queue.splice(0, 100);
        try {
          await removeBatch(batch);
          idx += batch.length;
          if (idx % 500 === 0) console.log(`Deleted ${idx}/${objects.length} ...`);
        } catch (e) {
          failures += batch.length;
          console.warn('Batch delete failed:', e.message || e);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }).map(() => worker()));
    console.log(`Done. Deleted ${objects.length - failures}/${objects.length} objects. Failures: ${failures}.`);
  }
  if (PURGE_DB) {
    await purgeDbTable();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });


