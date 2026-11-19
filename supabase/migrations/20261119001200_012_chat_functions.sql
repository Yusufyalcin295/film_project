
-- ==========================================
-- FILMMATCH CHAT - MESAJ GONDERME
-- ==========================================

CREATE OR REPLACE FUNCTION public.send_chat_message(
    p_match_id UUID,
    p_content TEXT
)
RETURNS public.messages
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_match public.matches%ROWTYPE;
    v_count INTEGER;
    v_message public.messages%ROWTYPE;
BEGIN
    -- Giris yapan kullanici
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Giris yapmalisiniz.';
    END IF;

    -- Eslesmeyi kilitle:
    -- ayni eslesmeye eszamanli mesaj gonderimini siralar
    SELECT *
    INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Eslesme bulunamadi.';
    END IF;

    -- Kullanici eslesmenin taraflarindan biri mi?
    IF v_user_id NOT IN (
        v_match.user1_id,
        v_match.user2_id
    ) THEN
        RAISE EXCEPTION 'Bu eslesmeye erisim izniniz yok.';
    END IF;

    -- Eslesme aktif mi?
    IF v_match.status <> 'active' THEN
        RAISE EXCEPTION 'Eslesme aktif degil.';
    END IF;

    -- Iki kullanicidan biri digerini engellemis mi?
    IF EXISTS (
        SELECT 1
        FROM public.user_actions
        WHERE action = 'block'
          AND (
              (actor_id = v_match.user1_id
               AND target_id = v_match.user2_id)
              OR
              (actor_id = v_match.user2_id
               AND target_id = v_match.user1_id)
          )
    ) THEN
        RAISE EXCEPTION 'Engellenen kullanicilar mesajlasamaz.';
    END IF;

    -- Mesaj uzunlugu
    IF p_content IS NULL
       OR char_length(btrim(p_content)) NOT BETWEEN 1 AND 300
    THEN
        RAISE EXCEPTION 'Mesaj 1-300 karakter olmali.';
    END IF;

    -- Kullanicinin bu eslesmede kac mesaj attigi
    SELECT COUNT(*)
    INTO v_count
    FROM public.messages
    WHERE match_id = p_match_id
      AND sender_id = v_user_id;

    IF v_count >= 20 THEN
        RAISE EXCEPTION '20 mesaj hakkiniz doldu.';
    END IF;

    -- Mesaji kaydet
    INSERT INTO public.messages (
        match_id,
        sender_id,
        content
    )
    VALUES (
        p_match_id,
        v_user_id,
        btrim(p_content)
    )
    RETURNING * INTO v_message;

    RETURN v_message;
END;
$$;

-- Yetkisiz roller fonksiyonu kullanamasin
REVOKE ALL ON FUNCTION public.send_chat_message(UUID, TEXT)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.send_chat_message(UUID, TEXT)
FROM anon;

-- Yalnizca giris yapmis kullanicilar
GRANT EXECUTE ON FUNCTION public.send_chat_message(UUID, TEXT)
TO authenticated;


-- ==========================================
-- MESAJ OKUMA YETKISI

-- ==========================================
-- CHAT MESAJ OKUMA KONTROLU
-- ==========================================

CREATE OR REPLACE FUNCTION public.can_read_chat_match(
    p_match_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN

    IF v_user_id IS NULL OR p_match_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.matches m
        WHERE m.id = p_match_id
          AND m.status = 'active'
          AND (
              m.user1_id = v_user_id
              OR m.user2_id = v_user_id
          )
          AND NOT EXISTS (
              SELECT 1
              FROM public.user_actions ua
              WHERE ua.action = 'block'
                AND (
                    (
                        ua.actor_id = m.user1_id
                        AND ua.target_id = m.user2_id
                    )
                    OR
                    (
                        ua.actor_id = m.user2_id
                        AND ua.target_id = m.user1_id
                    )
                )
          )
    );

END;
$$;


-- Sadece giris yapmis kullanicilar cagirabilsin
REVOKE ALL ON FUNCTION public.can_read_chat_match(UUID)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.can_read_chat_match(UUID)
TO authenticated;


-- ==========================================
-- MESAJ OKUMA POLITIKASI
-- ==========================================

CREATE POLICY "Participants can read chat messages"
ON public.messages
FOR SELECT
TO authenticated
USING (
    public.can_read_chat_match(match_id)
);


-- ==========================================
-- MESAJ TABLOSU YETKILERI
-- ==========================================

REVOKE ALL ON TABLE public.messages
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.messages
TO authenticated;
