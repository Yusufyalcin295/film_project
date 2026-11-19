
-- Test RLS visibility for actions and matches.
BEGIN;

SET LOCAL ROLE authenticated;

-- User A likes User B.
SELECT set_config(
    'request.jwt.claim.sub',
    '11111111-1111-4111-8111-111111111111',
    true
);

SELECT public.register_user_action(
    '22222222-2222-4222-8222-222222222222',
    'like'
);

-- User B likes User A.
SELECT set_config(
    'request.jwt.claim.sub',
    '22222222-2222-4222-8222-222222222222',
    true
);

SELECT public.register_user_action(
    '11111111-1111-4111-8111-111111111111',
    'like'
);

-- User A sees one match and one action.
SELECT set_config(
    'request.jwt.claim.sub',
    '11111111-1111-4111-8111-111111111111',
    true
);

SELECT COUNT(*) AS a_matches FROM public.matches;
SELECT COUNT(*) AS a_actions FROM public.user_actions;

-- User B sees one match and one action.
SELECT set_config(
    'request.jwt.claim.sub',
    '22222222-2222-4222-8222-222222222222',
    true
);

SELECT COUNT(*) AS b_matches FROM public.matches;
SELECT COUNT(*) AS b_actions FROM public.user_actions;

-- A third user cannot see these records.
SELECT set_config(
    'request.jwt.claim.sub',
    '33333333-3333-4333-8333-333333333333',
    true
);

SELECT COUNT(*) AS outsider_matches FROM public.matches;
SELECT COUNT(*) AS outsider_actions FROM public.user_actions;


-- Verify that an outsider cannot read private records.
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM public.matches) <> 0 THEN
        RAISE EXCEPTION 'RLS failed: outsider can read matches';
    END IF;

    IF (SELECT COUNT(*) FROM public.user_actions) <> 0 THEN
        RAISE EXCEPTION 'RLS failed: outsider can read actions';
    END IF;
END;
$$;


ROLLBACK;
