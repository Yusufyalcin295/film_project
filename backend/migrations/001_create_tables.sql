
-- Film Buddy database tables
-- Reference schema for a new database
-- Do not run against the existing Supabase database

CREATE TABLE public.movies (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    imdb_rank INTEGER,
    title TEXT NOT NULL,
    release_year INTEGER,
    imdb_rating NUMERIC,
    runtime_minutes INTEGER,
    poster_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    age INTEGER NOT NULL
        CHECK (age >= 18 AND age <= 99),
    gender TEXT NOT NULL
        CHECK (
            gender IN (
                'Kadın',
                'Erkek',
                'Belirtmek istemiyorum'
            )
        ),
    city TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_movies (
    user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    movie_id BIGINT NOT NULL
        REFERENCES public.movies(id) ON DELETE CASCADE,
    rating SMALLINT
        CHECK (rating >= 1 AND rating <= 5),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, movie_id)
);
