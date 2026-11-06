
-- ============================================================
-- JiguDev - Development Seed Script
-- Environment: Development only
--
-- Purpose:
--   1. Verify that the required migrations have been applied.
--   2. Verify that the core JiguDev tables exist.
--   3. Provide a safe starting point for future development data.
--
-- Important:
--   - This script does not create tables.
--   - This script does not create Supabase Auth users.
--   - This script does not grant Super Admin privileges.
--   - This script does not insert fabricated template definitions.
--   - Do not execute this script in production.
-- ============================================================

BEGIN;

DO $$
DECLARE
    required_tables TEXT[] := ARRAY[
        'profiles',
        'user_roles',
        'user_settings',
        'portfolios',
        'portfolio_content',
        'portfolio_versions',
        'templates',
        'template_versions',
        'template_reviews',
        'template_favourites',
        'assets',
        'resume_documents',
        'impersonation_sessions',
        'audit_logs'
    ];

    table_name TEXT;
    missing_tables TEXT[] := ARRAY[]::TEXT[];
BEGIN
    FOREACH table_name IN ARRAY required_tables
    LOOP
        IF to_regclass('public.' || table_name) IS NULL THEN
            missing_tables := array_append(
                missing_tables,
                table_name
            );
        END IF;
    END LOOP;

    IF cardinality(missing_tables) > 0 THEN
        RAISE EXCEPTION
            'JiguDev database setup is incomplete. Missing tables: %',
            array_to_string(missing_tables, ', ');
    END IF;

    RAISE NOTICE
        'JiguDev database verification successful. All expected tables exist.';
END;
$$;

COMMIT;
