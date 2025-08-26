-- Safe delete_quote that removes dependent rows before deleting the quote

drop function if exists public.delete_quote(uuid);
create or replace function public.delete_quote(p_quote_id uuid)
returns json language plpgsql as $$
declare
  v_org uuid;
  v_count int := 0;
begin
  -- Ensure the user is an active member of the quote's org
  select q.org_id into v_org from public.quotes q where q.id = p_quote_id;
  if v_org is null then
    raise exception 'Quote not found';
  end if;
  if not exists (
    select 1 from public.org_users ou where ou.user_id = auth.uid() and ou.org_id = v_org and ou.status = 'active'
  ) then
    raise exception 'Not authorized to delete this quote';
  end if;

  -- Delete production jobs linked to this quote (if any)
  delete from public.production_jobs pj where pj.quote_id = p_quote_id;

  -- Delete imprints (explicit) to avoid orphaned rows
  delete from public.quote_imprints qi where qi.quote_id = p_quote_id;

  -- Delete items (will cascade artwork_files via FK on quote_item_id)
  delete from public.quote_items qi where qi.quote_id = p_quote_id;

  -- Finally delete the quote
  delete from public.quotes q where q.id = p_quote_id;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Delete failed or quote not found';
  end if;

  return json_build_object('success', true);
end$$;




