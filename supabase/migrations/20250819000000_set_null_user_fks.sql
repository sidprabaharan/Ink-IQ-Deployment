-- Allow deleting auth.users by setting referencing columns to NULL instead of blocking
begin;

-- Quotes: creator/updater
alter table if exists public.quotes alter column created_by drop not null;
alter table if exists public.quotes drop constraint if exists quotes_created_by_fkey;
alter table if exists public.quotes drop constraint if exists quotes_updated_by_fkey;
alter table if exists public.quotes add constraint quotes_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table if exists public.quotes add constraint quotes_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

-- Artwork files: created_by
alter table if exists public.artwork_files alter column created_by drop not null;
alter table if exists public.artwork_files drop constraint if exists artwork_files_created_by_fkey;
alter table if exists public.artwork_files add constraint artwork_files_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;

-- Audit log: user reference
alter table if exists public.audit_log drop constraint if exists audit_log_user_id_fkey;
alter table if exists public.audit_log add constraint audit_log_user_id_fkey foreign key (user_id) references auth.users(id) on delete set null;

-- Invoices: creator/updater
alter table if exists public.invoices drop constraint if exists invoices_created_by_fkey;
alter table if exists public.invoices drop constraint if exists invoices_updated_by_fkey;
alter table if exists public.invoices add constraint invoices_created_by_fkey foreign key (created_by) references auth.users(id) on delete set null;
alter table if exists public.invoices add constraint invoices_updated_by_fkey foreign key (updated_by) references auth.users(id) on delete set null;

-- Invoice status history: changed_by
alter table if exists public.invoice_status_history drop constraint if exists invoice_status_history_changed_by_fkey;
alter table if exists public.invoice_status_history add constraint invoice_status_history_changed_by_fkey foreign key (changed_by) references auth.users(id) on delete set null;

commit;


