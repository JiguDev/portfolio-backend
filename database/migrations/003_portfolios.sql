BEGIN;

CREATE TABLE public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  template_version_id UUID,
  title VARCHAR(150) NOT NULL,
  slug VARCHAR(80) NOT NULL,
  status public.portfolio_status NOT NULL DEFAULT 'draft',
  seo_metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT portfolios_owner_slug_uq
    UNIQUE (owner_id, slug),

  CONSTRAINT portfolios_slug_format_chk
    CHECK (
      slug = LOWER(slug)
      AND slug ~ '^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$'
    ),

  CONSTRAINT portfolios_seo_object_chk
    CHECK (JSONB_TYPEOF(seo_metadata) = 'object'),

  CONSTRAINT portfolios_published_timestamp_chk
    CHECK (
      status <> 'published'
      OR published_at IS NOT NULL
    )
);

CREATE INDEX portfolios_owner_status_idx
  ON public.portfolios(owner_id, status, updated_at DESC);

CREATE INDEX portfolios_template_version_idx
  ON public.portfolios(template_version_id);

CREATE TABLE public.portfolio_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL UNIQUE
    REFERENCES public.portfolios(id) ON DELETE CASCADE,
  schema_version INTEGER NOT NULL DEFAULT 1,
  content JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT portfolio_content_schema_version_chk
    CHECK (schema_version > 0),

  CONSTRAINT portfolio_content_object_chk
    CHECK (JSONB_TYPEOF(content) = 'object')
);

CREATE TRIGGER portfolios_set_updated_at
BEFORE UPDATE ON public.portfolios
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

CREATE TRIGGER portfolio_content_set_updated_at
BEFORE UPDATE ON public.portfolio_content
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

-- Explicit snapshots, not snapshots on every autosave.
CREATE TABLE public.portfolio_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL
    REFERENCES public.portfolios(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content_snapshot JSONB NOT NULL,
  schema_version INTEGER NOT NULL,
  created_by UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT portfolio_versions_number_chk
    CHECK (version_number > 0),

  CONSTRAINT portfolio_versions_schema_chk
    CHECK (schema_version > 0),

  CONSTRAINT portfolio_versions_snapshot_object_chk
    CHECK (JSONB_TYPEOF(content_snapshot) = 'object'),

  CONSTRAINT portfolio_versions_portfolio_number_uq
    UNIQUE (portfolio_id, version_number)
);

CREATE INDEX portfolio_versions_history_idx
  ON public.portfolio_versions(portfolio_id, created_at DESC);

COMMIT;