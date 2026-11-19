
-- FILMMATCH CHAT
-- Mesajlarin tutulacagi tablo

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    match_id UUID NOT NULL
        REFERENCES public.matches(id)
        ON DELETE CASCADE,

    sender_id UUID NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    content TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT message_content_check
        CHECK (char_length(btrim(content)) BETWEEN 1 AND 300)
);

-- Mesajlari eslesmeye ve tarihe gore getirmek icin
CREATE INDEX idx_messages_match_time
ON public.messages(match_id, created_at, id);

-- Kullanicinin kac mesaj gonderdigini saymak icin
CREATE INDEX idx_messages_sender
ON public.messages(match_id, sender_id);

-- Veritabani guvenligini etkinlestir
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
