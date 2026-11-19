
-- Test mutual likes with simulated authenticated users.
BEGIN;

SET LOCAL ROLE authenticated;

-- User A likes user B.
SELECT set_config(
    'request.jwt.claim.sub',
    '11111111-1111-4111-8111-111111111111',
    true
);

SELECT public.register_user_action(
    '22222222-2222-4222-8222-222222222222',
    'like'
) AS first_like;

-- User B likes user A.
SELECT set_config(
    'request.jwt.claim.sub',
    '22222222-2222-4222-8222-222222222222',
    true
);

SELECT public.register_user_action(
    '11111111-1111-4111-8111-111111111111',
    'like'
) AS second_like;

-- Both users should now have an active match.
SELECT id, user1_id, user2_id, status
FROM public.matches;

-- Keep the test database unchanged.
ROLLBACK;
