-- Film Buddy: existing Supabase function definition
-- Keep as source reference; do not run against the current database.

CREATE OR REPLACE FUNCTION public.save_onboarding(p_profile jsonb, p_ratings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_item JSONB;
    v_movie_id BIGINT;
    v_rating SMALLINT;
    v_count INTEGER;
BEGIN
    -- Require authentication
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Validate profile
    IF p_profile IS NULL
       OR jsonb_typeof(p_profile) <> 'object'
       OR NULLIF(TRIM(p_profile->>'first_name'), '') IS NULL
       OR NULLIF(TRIM(p_profile->>'last_name'), '') IS NULL
       OR NULLIF(TRIM(p_profile->>'city'), '') IS NULL
       OR COALESCE(p_profile->>'age', '') !~ '^[0-9]{1,3}$'
       OR COALESCE(p_profile->>'gender', '') NOT IN
          ('Kadın', 'Erkek', 'Belirtmek istemiyorum')
    THEN
        RAISE EXCEPTION 'Invalid profile data';
    END IF;

    IF (p_profile->>'age')::INTEGER NOT BETWEEN 18 AND 99 THEN
        RAISE EXCEPTION 'Invalid age';
    END IF;

    -- Validate movie IDs
    PERFORM public.validate_movie_rating_ids(p_ratings);

    -- Validate and count ratings
    v_count := 0;

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_ratings)
    LOOP
        IF jsonb_typeof(v_item) <> 'object'
           OR COALESCE(v_item->>'movie_id', '') !~ '^[0-9]+$'
           OR (
               v_item->'rating' IS NOT NULL
               AND jsonb_typeof(v_item->'rating') <> 'null'
               AND (
                   jsonb_typeof(v_item->'rating') <> 'number'
                   OR v_item->>'rating' NOT IN
                      ('1', '2', '3', '4', '5')
               )
           )
        THEN
            RAISE EXCEPTION 'Invalid movie rating';
        END IF;

        IF v_item->>'rating' IN ('1', '2', '3', '4', '5') THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;

    -- Require 10 ratings for new profiles
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = v_user_id
    ) AND v_count < 10 THEN
        RAISE EXCEPTION 'At least 10 rated movies required';
    END IF;

    -- Save profile
    INSERT INTO public.profiles (
        id, first_name, last_name, age, gender, city
    )
    VALUES (
        v_user_id,
        TRIM(p_profile->>'first_name'),
        TRIM(p_profile->>'last_name'),
        (p_profile->>'age')::INTEGER,
        p_profile->>'gender',
        TRIM(p_profile->>'city')
    )
    ON CONFLICT (id)
    DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        age = EXCLUDED.age,
        gender = EXCLUDED.gender,
        city = EXCLUDED.city;

    -- Save movie ratings
    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_ratings)
    LOOP
        v_movie_id := (v_item->>'movie_id')::BIGINT;
        v_rating := (v_item->>'rating')::SMALLINT;

        INSERT INTO public.user_movies (
            user_id, movie_id, rating, updated_at
        )
        VALUES (
            v_user_id, v_movie_id, v_rating, NOW()
        )
        ON CONFLICT (user_id, movie_id)
        DO UPDATE SET
            rating = EXCLUDED.rating,
            updated_at = NOW();
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'rated_count', v_count
    );
END;
$function$
