-- Delete lead RPC

drop function if exists public.delete_lead(uuid);
create or replace function public.delete_lead(p_lead_id uuid)
returns void language sql as $$
  delete from public.leads l
  where l.id = p_lead_id
    and l.org_id in (
      select org_id from public.org_users where user_id = auth.uid() and status = 'active'
    );
$$;




