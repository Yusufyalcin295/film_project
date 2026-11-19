
/* ========================================
   FILMMATCH - CHAT API
======================================== */

const ChatAPI = {

  // Giriş yapan kullanıcıyı getir
  async getCurrentUser() {
    const { data, error } =
      await supabaseClient.auth.getUser();

    if (error) throw error;

    if (!data.user) {
      throw new Error("Önce giriş yapmalısınız.");
    }

    return data.user;
  },


  // Eşleşmenin mesaj geçmişini getir
  async getMessages(matchId) {
    const { data, error } = await supabaseClient
      .from("messages")
      .select("id, match_id, sender_id, content, created_at")
      .eq("match_id", matchId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;

    return data || [];
  },


  // Yeni mesaj gönder
  async sendMessage(matchId, text) {
    const content = text.trim();

    if (!content || content.length > 300) {
      throw new Error("Mesaj 1-300 karakter olmalı.");
    }

    const { data, error } = await supabaseClient.rpc(
      "send_chat_message",
      {
        p_match_id: matchId,
        p_content: content
      }
    );

    if (error) throw error;

    return data;
  },


  // Kullanıcının gönderdiği mesajları say
  async getSentCount(matchId) {
    const user = await this.getCurrentUser();

    const { count, error } = await supabaseClient
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("match_id", matchId)
      .eq("sender_id", user.id);

    if (error) throw error;

    return count || 0;
  },


  // Yeni mesajları canlı dinle
  subscribeToMessages(matchId, onMessage) {
    const channel = supabaseClient
      .channel(`chat:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`
        },
        (payload) => {
          onMessage(payload.new);
        }
      )
      .subscribe();

    return channel;
  },


  // Dinlemeyi kapat
  async unsubscribe(channel) {
    if (channel) {
      await supabaseClient.removeChannel(channel);
    }
  }

};
