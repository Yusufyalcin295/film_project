-- Film Buddy: existing Supabase function definition
-- Keep as source reference; do not run against the current database.

CREATE OR REPLACE FUNCTION public.validate_movie_rating_ids(p_ratings jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    v_item JSONB;
    v_movie_id BIGINT;
    v_total INTEGER := 0;
    v_unique INTEGER;
    v_ids BIGINT[] := ARRAY[]::BIGINT[];
BEGIN
    -- Require a valid array
    IF p_ratings IS NULL
       OR jsonb_typeof(p_ratings) <> 'array'
    THEN
        RAISE EXCEPTION 'Invalid ratings array';
    END IF;

    FOR v_item IN
        SELECT value
        FROM jsonb_array_elements(p_ratings)
    LOOP
        -- Require a valid movie ID
        IF jsonb_typeof(v_item) <> 'object'
           OR COALESCE(v_item->>'movie_id', '') !~ '^[0-9]+$'
        THEN
            RAISE EXCEPTION 'Invalid movie ID';
        END IF;

        -- Handle numbers outside BIGINT range
        BEGIN
            v_movie_id := (v_item->>'movie_id')::BIGINT;
        EXCEPTION
            WHEN numeric_value_out_of_range THEN
                RAISE EXCEPTION 'Movie ID out of range';
        END;

        -- Require a positive movie ID
        IF v_movie_id <= 0 THEN
            RAISE EXCEPTION 'Invalid movie ID';
        END IF;

        v_ids := array_append(v_ids, v_movie_id);
        v_total := v_total + 1;
    END LOOP;

    -- Check duplicate IDs
    SELECT COUNT(DISTINCT id)
    INTO v_unique
    FROM unnest(v_ids) AS id;

    IF v_total <> v_unique THEN
        RAISE EXCEPTION 'Duplicate movie IDs';
    END IF;

    RETURN TRUE;
END;
$function$
