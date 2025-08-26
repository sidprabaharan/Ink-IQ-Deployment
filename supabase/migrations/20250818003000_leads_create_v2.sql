-- Extended create_lead RPC to accept business info and social links

drop function if exists public.create_lead_v2(text, text, text, text, text, numeric, text, text, text, numeric, text, text, text);
create or replace function public.create_lead_v2(
  p_name text,
  p_company text,
  p_email text,
  p_phone text,
  p_status text default 'new_lead',
  p_value numeric default 0,
  p_notes text default null,
  p_website text default null,
  p_company_size text default null,
  p_estimated_spend numeric default null,
  p_linkedin text default null,
  p_facebook text default null,
  p_twitter text default null
)
returns json language plpgsql as $$
declare
  v_org uuid;
  v_id uuid := gen_random_uuid();
  v_company_info jsonb;
  v_social_profiles jsonb;
begin
  select org_id into v_org from public.org_users where user_id = auth.uid() and status='active' limit 1;
  if v_org is null then
    raise exception 'No organization found for user';
  end if;

  v_company_info := jsonb_build_object(
    'website', p_website,
    'size', p_company_size,
    'estimatedAnnualSpend', p_estimated_spend
  );

  v_social_profiles := jsonb_strip_nulls(jsonb_build_object(
    'linkedin', p_linkedin,
    'facebook', p_facebook,
    'twitter', p_twitter
  ));

  insert into public.leads(
    id, org_id, name, company, email, phone, status, value, notes,
    company_info, social_profiles
  )
  values (
    v_id, v_org, p_name, p_company, p_email, p_phone,
    coalesce(p_status,'new_lead'), coalesce(p_value,0), p_notes,
    nullif(v_company_info, '{}'::jsonb), nullif(v_social_profiles, '{}'::jsonb)
  );

  return json_build_object('lead_id', v_id);
end$$;




