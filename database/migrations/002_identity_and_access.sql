BEGIN;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username VARCHAR(40) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  avatar_path TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT profiles_username_format_chk
    CHECK (
      username = LOWER(username)
      AND username ~ '^[a-z0-9](?:[a-z0-9_-]{1,38}[a-z0-9])?$'
    )
);

CREATE UNIQUE INDEX profiles_username_uq
  ON public.profiles(username);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_roles_user_role_uq UNIQUE (user_id, role)
);

CREATE INDEX user_roles_user_id_idx
  ON public.user_roles(user_id);

CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT user_settings_object_chk
    CHECK (JSONB_TYPEOF(settings) = 'object')
);

-- Shared updated_at trigger function.
CREATE OR REPLACE FUNCTION app_private.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

CREATE TRIGGER user_settings_set_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

-- Enforce permanent usernames at database level.
CREATE OR REPLACE FUNCTION app_private.prevent_username_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username THEN
    RAISE EXCEPTION 'Username is permanent and cannot be changed'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_username_immutable
BEFORE UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION app_private.prevent_username_change();

COMMIT;