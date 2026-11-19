
-- Handle likes, passes and blocks securely.
CREATE OR REPLACE FUNCTION public.register_user_action(
    p_target_id UUID,
    p_action TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor_id UUID := (SELECT auth.uid());
    v_actor_count INTEGER;
    v_target_count INTEGER;
    v_common_count INTEGER;
    v_mutual BOOLEAN := FALSE;
BEGIN
    -- Validate the caller and action.
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF p_target_id IS NULL OR p_target_id = v_actor_id THEN
        RAISE EXCEPTION 'Invalid target user';
    END IF;

    IF p_action IS NULL
       OR p_action NOT IN ('like', 'pass', 'block', 'unblock') THEN
        RAISE EXCEPTION 'Invalid action';
    END IF;

    -- Serialize actions for the same user pair.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(
            'film-buddy-match:' ||
            LEAST(v_actor_id, p_target_id)::TEXT || ':' ||
            GREATEST(v_actor_id, p_target_id)::TEXT,
            0
        )
    );

    -- Remove the caller's block.
    IF p_action = 'unblock' THEN
        DELETE FROM public.user_actions
        WHERE actor_id = v_actor_id
          AND target_id = p_target_id
          AND action = 'block';

        -- Unblocking does not reactivate a match.
        RETURN jsonb_build_object(
            'success', TRUE,
            'action', 'unblock',
            'mutual', FALSE
        );
    END IF;

    IF p_action = 'like' THEN
        -- Do not allow likes after a block or reverse pass.
        IF EXISTS (
            SELECT 1
            FROM public.user_actions
            WHERE (
                actor_id = v_actor_id
                AND target_id = p_target_id
                AND action = 'block'
            ) OR (
                actor_id = p_target_id
                AND target_id = v_actor_id
                AND action IN ('block', 'pass')
            )
        ) THEN
            RAISE EXCEPTION 'User is not eligible for a like';
        END IF;

        -- Both users must have at least 10 ratings.
        SELECT COUNT(*) INTO v_actor_count
        FROM public.user_movies
        WHERE user_id = v_actor_id AND rating IS NOT NULL;

        SELECT COUNT(*) INTO v_target_count
        FROM public.user_movies
        WHERE user_id = p_target_id AND rating IS NOT NULL;

        IF v_actor_count < 10 OR v_target_count < 10 THEN
            RAISE EXCEPTION 'Both users must rate 10 movies';
        END IF;

        -- Require at least 3 commonly rated movies.
        SELECT COUNT(*) INTO v_common_count
        FROM public.user_movies a
        JOIN public.user_movies b
          ON a.movie_id = b.movie_id
        WHERE a.user_id = v_actor_id
          AND b.user_id = p_target_id
          AND a.rating IS NOT NULL
          AND b.rating IS NOT NULL;

        IF v_common_count < 3 THEN
            RAISE EXCEPTION 'Not enough common movies';
        END IF;
    END IF;

    -- Save or replace the current action.
    INSERT INTO public.user_actions (
        actor_id, target_id, action
    )
    VALUES (v_actor_id, p_target_id, p_action)
    ON CONFLICT (actor_id, target_id)
    DO UPDATE SET
        action = EXCLUDED.action,
        updated_at = NOW();

    IF p_action = 'like' THEN
        -- Check whether the other user already liked us.
        SELECT EXISTS (
            SELECT 1
            FROM public.user_actions
            WHERE actor_id = p_target_id
              AND target_id = v_actor_id
              AND action = 'like'
        ) INTO v_mutual;

        IF v_mutual THEN
            -- Create one match per user pair.
            INSERT INTO public.matches (
                user1_id, user2_id, status
            )
            VALUES (
                LEAST(v_actor_id, p_target_id),
                GREATEST(v_actor_id, p_target_id),
                'active'
            )
            ON CONFLICT (user1_id, user2_id)
            DO UPDATE SET status = 'active';
        END IF;
    ELSE
        -- Invalidate the other user's old like.
        DELETE FROM public.user_actions
        WHERE actor_id = p_target_id
          AND target_id = v_actor_id
          AND action = 'like';

        -- A pass or block ends an existing match.
        UPDATE public.matches
        SET status = 'inactive'
        WHERE user1_id = LEAST(v_actor_id, p_target_id)
          AND user2_id = GREATEST(v_actor_id, p_target_id);
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'action', p_action,
        'mutual', v_mutual
    );
END;
$$;

-- Restrict who can execute the function.
REVOKE ALL ON FUNCTION public.register_user_action(UUID, TEXT)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.register_user_action(UUID, TEXT)
TO authenticated;
