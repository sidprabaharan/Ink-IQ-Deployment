-- Replace delete_quote to also delete related invoices and their rows

create or replace function public.delete_quote(p_quote_id uuid)
returns json language plpgsql as $$
declare
  v_org uuid;
  v_invoice_ids uuid[];
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

  -- Collect invoices created from this quote
  select array_agg(id) into v_invoice_ids from public.invoices where quote_id = p_quote_id;

  if v_invoice_ids is not null then
    -- Delete invoice children first
    delete from public.invoice_payments where invoice_id = any(v_invoice_ids);
    delete from public.invoice_status_history where invoice_id = any(v_invoice_ids);
    delete from public.invoice_items where invoice_id = any(v_invoice_ids);
    delete from public.invoices where id = any(v_invoice_ids);
  end if;

  -- Delete production jobs linked to this quote (if any)
  delete from public.production_jobs pj where pj.quote_id = p_quote_id;

  -- Delete imprints explicitly
  delete from public.quote_imprints qi where qi.quote_id = p_quote_id;

  -- Delete items (artwork_files should cascade via FK)
  delete from public.quote_items qi where qi.quote_id = p_quote_id;

  -- Finally delete the quote
  delete from public.quotes q where q.id = p_quote_id;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Delete failed or quote not found';
  end if;

  return json_build_object('success', true);
end$$;




