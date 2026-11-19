
-- Test blocking and unblocking a matched user.
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

-- Match should be inactive.
SELECT status AS after_block
FROM public.matches;

-- User A unblocks B.
SELECT public.register_user_action(
    '22222222-2222-4222-8222-222222222222',
    'unblock'
);

-- Match should remain inactive.
SELECT status AS after_unblock
FROM public.matches;

-- Discard test changes.
ROLLBACK;
