-- Ensure user has an org; allow duplicate names by generating unique slugs

drop function if exists public.ensure_user_org(text, text);
create or replace function public.ensure_user_org(
  p_company_name text,
  p_full_name text default null
)
returns json language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_org_id uuid;
  v_slug text;
  v_base_slug text;
  v_suffix int := 1;
  v_email text;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- If the user already belongs to an org, return first membership
  select org_id into v_org_id from public.org_users where user_id = v_user limit 1;
  if v_org_id is not null then
    select slug into v_slug from public.orgs where id = v_org_id;
    return json_build_object('org_id', v_org_id, 'org_slug', v_slug, 'existing', true);
  end if;

  -- Build a unique slug from company name
  v_base_slug := regexp_replace(lower(coalesce(p_company_name, 'company')),'[^a-z0-9]+','-','g');
  v_base_slug := trim(both '-' from v_base_slug);
  if v_base_slug = '' then v_base_slug := 'company'; end if;
  v_slug := v_base_slug;
  while exists (select 1 from public.orgs where slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix::text;
  end loop;

  -- Create org
  insert into public.orgs(id, name, slug, settings)
  values (gen_random_uuid(), p_company_name, v_slug, null)
  returning id into v_org_id;

  -- Link user as owner
  insert into public.org_users(user_id, org_id, role, status)
  values (v_user, v_org_id, 'owner', 'active');

  -- Upsert profile with full name if provided
  select email into v_email from auth.users where id = v_user;
  insert into public.profiles(id, email, full_name)
  values (v_user, v_email, nullif(p_full_name, ''))
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  return json_build_object('org_id', v_org_id, 'org_slug', v_slug, 'existing', false);
end$$;




