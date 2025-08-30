-- RLS policies for org_users so users can see/manage their memberships

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'org_users' AND policyname = 'user can select own org_users'
  ) THEN
    CREATE POLICY "user can select own org_users" ON public.org_users
      FOR SELECT TO public
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'org_users' AND policyname = 'user can insert own org_users'
  ) THEN
    CREATE POLICY "user can insert own org_users" ON public.org_users
      FOR INSERT TO public
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'org_users' AND policyname = 'user can update own org_users'
  ) THEN
    CREATE POLICY "user can update own org_users" ON public.org_users
      FOR UPDATE TO public
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Note: get_user_org_info function already exists remotely; skipping creation to avoid signature conflicts.




