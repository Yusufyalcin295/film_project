
-- Test rematching after a block.
BEGIN;

SET LOCAL ROLE authenticated;

-- User A likes B.
SELECT set_config(
    'request.jwt.claim.sub',
    '11111111-1111-4111-8111-111111111111',
    true
);

SELECT public.register_user_action(
    '22222222-2222-4222-8222-222222222222',
    'like'
);

-- User B likes A.
SELECT set_config(
    'request.jwt.claim.sub',
    '22222222-2222-4222-8222-222222222222',
    true
);

SELECT public.register_user_action(
    '11111111-1111-4111-8111-111111111111',
    'like'
);

-- User A blocks B.
SELECT set_config(
    'request.jwt.claim.sub',
    '11111111-1111-4111-8111-111111111111',
    true
);

SELECT public.register_user_action(
    '22222222-2222-4222-8222-222222222222',
    'block'
);

-- User A removes the block.
SELECT public.register_user_action(
    '22222222-2222-4222-8222-222222222222',
    'unblock'
);

-- User A likes B again.
SELECT public.register_user_action(
    '22222222-2222-4222-8222-222222222222',
    'like'
) AS like_after_unblock;

-- Check whether the old reverse like reactivates the match.
SELECT status AS match_status
FROM public.matches
WHERE user1_id = '11111111-1111-4111-8111-111111111111'
  AND user2_id = '22222222-2222-4222-8222-222222222222';


-- Fail if an old like reactivates the match.
DO $$
DECLARE
    v_status TEXT;
BEGIN
    SELECT status INTO v_status
    FROM public.matches
    WHERE user1_id = '11111111-1111-4111-8111-111111111111'
      AND user2_id = '22222222-2222-4222-8222-222222222222';

    IF v_status IS DISTINCT FROM 'inactive' THEN
        RAISE EXCEPTION
            'Rematch test failed: expected inactive, got %',
            v_status;
    END IF;
END;
$$;


ROLLBACK;
