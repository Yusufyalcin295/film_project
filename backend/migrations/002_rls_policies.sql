
-- Film Buddy RLS policies
-- Reference for a new database
-- Do not run against the existing database

ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_movies ENABLE ROW LEVEL SECURITY;

-- Movies: public read access
CREATE POLICY "Anyone can read movies"
ON public.movies
FOR SELECT
TO anon, authenticated
USING (true);

-- Profiles: users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Profiles: users can read their own profile
CREATE POLICY "Users can read own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Profiles: users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Ratings: users can insert their own ratings
CREATE POLICY "Users can insert own ratings"
ON public.user_movies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Ratings: users can read their own ratings
CREATE POLICY "Users can read own ratings"
ON public.user_movies
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Ratings: users can update their own ratings
CREATE POLICY "Users can update own ratings"
ON public.user_movies
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
