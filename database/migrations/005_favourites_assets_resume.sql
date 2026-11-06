BEGIN;

CREATE TABLE public.template_favourites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id UUID NOT NULL
    REFERENCES public.templates(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT template_favourites_user_template_uq
    UNIQUE (user_id, template_id)
);

CREATE INDEX template_favourites_user_created_idx
  ON public.template_favourites(user_id, created_at DESC);

CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  storage_bucket VARCHAR(100) NOT NULL,
  storage_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT assets_file_size_chk CHECK (file_size >= 0),

  CONSTRAINT assets_bucket_path_uq
    UNIQUE (storage_bucket, storage_path)
);

CREATE INDEX assets_owner_created_idx
  ON public.assets(owner_id, created_at DESC);

-- PDF bytes are stored in Supabase Storage, not PostgreSQL.
CREATE TABLE public.resume_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  portfolio_id UUID NOT NULL
    REFERENCES public.portfolios(id) ON DELETE RESTRICT,
  title VARCHAR(150) NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}'::JSONB,
  storage_bucket VARCHAR(100) NOT NULL DEFAULT 'resume-documents',
  storage_path TEXT,
  mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
  file_size BIGINT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT resume_documents_configuration_object_chk
    CHECK (JSONB_TYPEOF(configuration) = 'object'),

  CONSTRAINT resume_documents_mime_chk
    CHECK (mime_type = 'application/pdf'),

  CONSTRAINT resume_documents_file_size_chk
    CHECK (file_size IS NULL OR file_size >= 0),

  CONSTRAINT resume_documents_storage_state_chk
    CHECK (
      (storage_path IS NULL AND generated_at IS NULL)
      OR
      (storage_path IS NOT NULL AND generated_at IS NOT NULL)
    )
);

CREATE INDEX resume_documents_owner_created_idx
  ON public.resume_documents(owner_id, created_at DESC);

CREATE INDEX resume_documents_portfolio_idx
  ON public.resume_documents(portfolio_id);

CREATE TRIGGER resume_documents_set_updated_at
BEFORE UPDATE ON public.resume_documents
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

-- Enforce that the resume owner owns the referenced portfolio.
CREATE OR REPLACE FUNCTION app_private.enforce_resume_portfolio_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  portfolio_owner UUID;
BEGIN
  SELECT owner_id
  INTO portfolio_owner
  FROM public.portfolios
  WHERE id = NEW.portfolio_id;

  IF portfolio_owner IS NULL OR portfolio_owner <> NEW.owner_id THEN
    RAISE EXCEPTION 'Resume owner must own the referenced portfolio'
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER resume_documents_owner_consistency
BEFORE INSERT OR UPDATE OF owner_id, portfolio_id
ON public.resume_documents
FOR EACH ROW
EXECUTE FUNCTION app_private.enforce_resume_portfolio_owner();

COMMIT;