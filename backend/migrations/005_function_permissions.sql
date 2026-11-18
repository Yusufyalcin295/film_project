
-- Film Buddy function permissions
-- Run after creating the functions
-- Do not run against the existing database

-- Remove public execution access
REVOKE ALL ON FUNCTION public.save_onboarding(jsonb, jsonb)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.validate_movie_rating_ids(jsonb)
FROM PUBLIC;

-- Allow authenticated users
GRANT EXECUTE ON FUNCTION public.save_onboarding(jsonb, jsonb)
TO authenticated;

GRANT EXECUTE ON FUNCTION public.validate_movie_rating_ids(jsonb)
TO authenticated;
