BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app_private;

CREATE TYPE public.app_role AS ENUM (
  'user',
  'super_admin'
);

CREATE TYPE public.portfolio_status AS ENUM (
  'draft',
  'published',
  'archived'
);

CREATE TYPE public.template_type AS ENUM (
  'platform',
  'personal'
);

CREATE TYPE public.template_visibility AS ENUM (
  'private',
  'public'
);

CREATE TYPE public.template_approval_status AS ENUM (
  'not_submitted',
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE public.template_review_decision AS ENUM (
  'approved',
  'rejected'
);

CREATE TYPE public.impersonation_access_mode AS ENUM (
  'read_only',
  'full_access'
);

COMMIT;