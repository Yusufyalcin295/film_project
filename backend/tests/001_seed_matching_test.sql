
-- Create local test users and movies.
BEGIN;

INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
)
VALUES
(
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'test-a@film-buddy.example',
    '',
    NOW(), NOW(), NOW()
),
(
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'test-b@film-buddy.example',
    '',
    NOW(), NOW(), NOW()
);

INSERT INTO public.profiles (
    id, first_name, last_name, age, gender, city
)
VALUES
(
    '11111111-1111-4111-8111-111111111111',
    'Test', 'A', 23, 'Erkek', 'Adana'
),
(
    '22222222-2222-4222-8222-222222222222',
    'Test', 'B', 24, 'Kadın', 'Adana'
);

-- Use explicit IDs in this local test only.
INSERT INTO public.movies (
    id, imdb_rank, title, release_year
)
OVERRIDING SYSTEM VALUE
SELECT
    n, n, 'Test Movie ' || n, 2020
FROM generate_series(1, 10) AS n;

INSERT INTO public.user_movies (
    user_id, movie_id, rating
)
SELECT
    '11111111-1111-4111-8111-111111111111'::UUID,
    id,
    5
FROM public.movies;

INSERT INTO public.user_movies (
    user_id, movie_id, rating
)
SELECT
    '22222222-2222-4222-8222-222222222222'::UUID,
    id,
    4
FROM public.movies;

COMMIT;
