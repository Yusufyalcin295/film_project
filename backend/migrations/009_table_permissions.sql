
-- Limit movie catalog access to reading.
REVOKE ALL ON TABLE public.movies
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.movies
TO anon, authenticated;

-- Allow signed-in users to manage their own profiles.
REVOKE ALL ON TABLE public.profiles
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles
TO authenticated;

-- Allow signed-in users to manage their own ratings.
REVOKE ALL ON TABLE public.user_movies
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE public.user_movies
TO authenticated;
