BEGIN;

CREATE TABLE public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  category VARCHAR(60),
  template_type public.template_type NOT NULL,
  visibility public.template_visibility NOT NULL DEFAULT 'private',
  approval_status public.template_approval_status
    NOT NULL DEFAULT 'not_submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT templates_type_owner_chk CHECK (
    (template_type = 'platform' AND owner_id IS NULL)
    OR
    (template_type = 'personal' AND owner_id IS NOT NULL)
  ),

  CONSTRAINT templates_platform_visibility_chk CHECK (
    template_type <> 'platform'
    OR visibility = 'public'
  ),

  CONSTRAINT templates_public_approval_chk CHECK (
    visibility <> 'public'
    OR template_type = 'platform'
    OR approval_status = 'approved'
  )
);

CREATE INDEX templates_owner_created_idx
  ON public.templates(owner_id, created_at DESC);

CREATE INDEX templates_discovery_idx
  ON public.templates(
    visibility,
    approval_status,
    category,
    created_at DESC
  );

CREATE TRIGGER templates_set_updated_at
BEFORE UPDATE ON public.templates
FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();

CREATE TABLE public.template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL
    REFERENCES public.templates(id) ON DELETE RESTRICT,
  version_number INTEGER NOT NULL,
  template_definition JSONB NOT NULL,
  preview_asset_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT template_versions_number_chk
    CHECK (version_number > 0),

  CONSTRAINT template_versions_definition_object_chk
    CHECK (JSONB_TYPEOF(template_definition) = 'object'),

  CONSTRAINT template_versions_template_number_uq
    UNIQUE (template_id, version_number),

  CONSTRAINT template_versions_id_template_uq
    UNIQUE (id, template_id)
);

CREATE INDEX template_versions_template_created_idx
  ON public.template_versions(template_id, created_at DESC);

-- A portfolio can only reference an existing template version.
ALTER TABLE public.portfolios
ADD CONSTRAINT portfolios_template_version_fk
FOREIGN KEY (template_version_id)
REFERENCES public.template_versions(id)
ON DELETE RESTRICT;

-- Review decisions are tied to the exact template version.
CREATE TABLE public.template_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  template_version_id UUID NOT NULL,
  reviewer_id UUID
    REFERENCES public.profiles(id) ON DELETE SET NULL,
  decision public.template_review_decision NOT NULL,
  comments TEXT,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT template_reviews_version_template_fk
    FOREIGN KEY (template_version_id, template_id)
    REFERENCES public.template_versions(id, template_id)
    ON DELETE RESTRICT
);

CREATE INDEX template_reviews_template_history_idx
  ON public.template_reviews(template_id, reviewed_at DESC);

CREATE INDEX template_reviews_version_idx
  ON public.template_reviews(template_version_id, reviewed_at DESC);

-- Template versions are immutable.
CREATE OR REPLACE FUNCTION app_private.prevent_template_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'Template versions are immutable; create a new version'
    USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER template_versions_immutable
BEFORE UPDATE OR DELETE ON public.template_versions
FOR EACH ROW EXECUTE FUNCTION app_private.prevent_template_version_mutation();

COMMIT;