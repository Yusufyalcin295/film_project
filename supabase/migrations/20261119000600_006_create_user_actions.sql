
-- Store user interactions for matching.

CREATE TABLE IF NOT EXISTS public.user_actions (
    actor_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,

    target_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,

    action TEXT NOT NULL
        CHECK (action IN ('like', 'pass', 'block')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (actor_id, target_id),

    CONSTRAINT no_self_action
        CHECK (actor_id <> target_id)
);

-- Enable row-level security.
ALTER TABLE public.user_actions ENABLE ROW LEVEL SECURITY;

-- Users can only read their own outgoing actions.
CREATE POLICY "Users can read own actions"
ON public.user_actions
FOR SELECT
TO authenticated
USING ((SELECT auth.uid()) = actor_id);

-- Make actor lookups efficient.
CREATE INDEX IF NOT EXISTS idx_user_actions_actor_action
ON public.user_actions (actor_id, action);

-- Only trusted backend functions may change user actions.
REVOKE INSERT, UPDATE, DELETE
ON public.user_actions
FROM PUBLIC, anon, authenticated;
