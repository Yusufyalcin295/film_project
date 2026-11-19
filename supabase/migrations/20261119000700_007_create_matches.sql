
-- Store mutual user matches.
CREATE TABLE public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user1_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,

    user2_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,

   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

-- Keep the match record when users disconnect.
status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),

    CONSTRAINT different_match_users
        CHECK (user1_id <> user2_id),

    CONSTRAINT ordered_match_users
        CHECK (user1_id < user2_id),

    CONSTRAINT unique_match_pair
        UNIQUE (user1_id, user2_id)
);

-- Enable row-level security.
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Participants can read their matches.
CREATE POLICY "Participants can read matches"
ON public.matches
FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) = user1_id
    OR
    (SELECT auth.uid()) = user2_id
);

-- Speed up participant lookups.
CREATE INDEX idx_matches_user1
ON public.matches (user1_id);

CREATE INDEX idx_matches_user2
ON public.matches (user2_id);

-- Only trusted backend functions may modify matches.
REVOKE INSERT, UPDATE, DELETE
ON public.matches
FROM PUBLIC, anon, authenticated;

-- Only trusted backend functions may modify matches.
REVOKE INSERT, UPDATE, DELETE
ON public.matches
FROM PUBLIC, anon, authenticated;
