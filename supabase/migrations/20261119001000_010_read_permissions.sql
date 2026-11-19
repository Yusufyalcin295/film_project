
-- Remove public read access to user actions.
REVOKE SELECT ON TABLE public.user_actions
FROM PUBLIC, anon;

-- Allow signed-in users to read their own actions.
GRANT SELECT ON TABLE public.user_actions
TO authenticated;

-- Remove public read access to matches.
REVOKE SELECT ON TABLE public.matches
FROM PUBLIC, anon;

-- Allow signed-in users to read their own matches.
GRANT SELECT ON TABLE public.matches
TO authenticated;
