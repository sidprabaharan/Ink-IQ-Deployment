Database Snapshots (No Docker)

This folder contains point-in-time snapshots of schema metadata and selected data from the Supabase project `eqdlaagjaikxdrkgvopn`.

Contents:
- latest/schema.meta.json: Tables, columns, PKs/FKs, indexes.
- latest/data.json: Selected public tables exported as JSON (orgs, customers, products, quotes, quote_items, invoices, invoice_items, profiles).

Restore guidance:
- Exact pg_dump restore requires Docker Desktop or Postgres pg_dump tools. Once available, use Supabase CLI db dump to create a full SQL dump and restore via psql.
- For now, you can write a small loader script to re-insert JSON rows into a clean database (respecting FK order and RLS policies).

Maintenance:
- Re-run snapshot after major changes to keep in sync. Consider automating via a script/Action once Docker or pg_dump is available.


