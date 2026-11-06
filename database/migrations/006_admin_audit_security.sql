BEGIN;

CREATE TABLE public.impersonation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  target_user_id UUID NOT NULL
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  session_token_hash TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  access_mode public.impersonation_access_mode
    NOT NULL DEFAULT 'read_only',

  CONSTRAINT impersonation_not_self_chk
    CHECK (admin_id <> target_user_id),

  CONSTRAINT impersonation_reason_nonempty_chk
    CHECK (LENGTH(BTRIM(reason)) > 0),

  CONSTRAINT impersonation_expiry_chk
    CHECK (expires_at > started_at),

  CONSTRAINT impersonation_end_chk
    CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE INDEX impersonation_admin_started_idx
  ON public.impersonation_sessions(admin_id, started_at DESC);

CREATE INDEX impersonation_target_started_idx
  ON public.impersonation_sessions(target_user_id, started_at DESC);

CREATE UNIQUE INDEX impersonation_one_active_per_admin_uq
  ON public.impersonation_sessions(admin_id)
  WHERE ended_at IS NULL;

CREATE TABLE public.audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL,
  resource_type VARCHAR(80) NOT NULL,
  resource_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_logs_metadata_object_chk
    CHECK (JSONB_TYPEOF(metadata) = 'object')
);

CREATE INDEX audit_logs_actor_created_idx
  ON public.audit_logs(actor_id, created_at DESC);

CREATE INDEX audit_logs_resource_created_idx
  ON public.audit_logs(resource_type, resource_id, created_at DESC);

-- Audit records are append-only.
CREATE OR REPLACE FUNCTION app_private.reject_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'Audit log records are append-only'
    USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER audit_logs_no_update_delete
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION app_private.reject_audit_log_mutation();

-- Published portfolios require content and a selected template version.
CREATE OR REPLACE FUNCTION app_private.enforce_published_portfolio_requirements()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status = 'published' THEN
    IF NEW.template_version_id IS NULL THEN
      RAISE EXCEPTION 'Published portfolio requires a template version'
        USING ERRCODE = 'check_violation';
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.portfolio_content pc
      WHERE pc.portfolio_id = NEW.id
    ) THEN
      RAISE EXCEPTION 'Published portfolio requires portfolio content'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE CONSTRAINT TRIGGER portfolios_published_requirements
AFTER INSERT OR UPDATE OF status, template_version_id
ON public.portfolios
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION app_private.enforce_published_portfolio_requirements();

-- Prevent removing content while its portfolio remains published.
CREATE OR REPLACE FUNCTION app_private.prevent_published_content_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.portfolios p
    WHERE p.id = OLD.portfolio_id
      AND p.status = 'published'
  ) THEN
    RAISE EXCEPTION 'Cannot remove content from a published portfolio'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$;

CREATE TRIGGER portfolio_content_published_delete_guard
BEFORE DELETE ON public.portfolio_content
FOR EACH ROW
EXECUTE FUNCTION app_private.prevent_published_content_removal();

-- RLS baseline: no direct anon/authenticated policies are created.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

COMMIT;