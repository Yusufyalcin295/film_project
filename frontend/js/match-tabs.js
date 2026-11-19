
/* =========================================
   FILMMATCH - EŞLEŞMELER / SOHBET SEKME SİSTEMİ
========================================= */

(function () {

  const page = document.getElementById("pageMatches");
  const chat = document.getElementById("sChat");
  const tabs = document.getElementById("tabs");
  const list = document.getElementById("list");

  if (!page || !chat || !tabs || !list) {
    console.error("Eşleşme veya sohbet sayfası bulunamadı.");
    return;
  }

  // İki yeni alt sekme oluşturuyoruz
  const nav = document.createElement("div");
  nav.className = "match-subtabs";

  nav.innerHTML = `
    <button type="button" id="subMatches" class="active">
      💜 Eşleşmeler
    </button>

    <button type="button" id="subChats">
      💬 Sohbet
    </button>
  `;

  // Mevcut adaylar, size ilgi ve eşleşmeler bölümleri
  const matchesArea = document.createElement("div");
  matchesArea.id = "matchesArea";

  matchesArea.append(tabs, list);

  // Eski sohbet ekranını yeni sekmenin içine taşıyoruz
  const chatsArea = document.createElement("div");
  chatsArea.id = "chatsArea";
  chatsArea.className = "hide";

  chatsArea.append(chat);

  // İki sekmeyi eşleşmeler sayfasına ekliyoruz
  page.append(nav, matchesArea, chatsArea);

  const matchesButton = document.getElementById("subMatches");
  const chatsButton = document.getElementById("subChats");

  let activeTab = "matches";


  // =========================================
  // SEKME DEĞİŞTİRME
  // =========================================

  function switchTab(name) {

    activeTab = name;

    const isChat = name === "chat";

    matchesArea.classList.toggle("hide", isChat);
    chatsArea.classList.toggle("hide", !isChat);
    chat.classList.toggle("hide", !isChat);

    matchesButton.classList.toggle("active", !isChat);
    chatsButton.classList.toggle("active", isChat);

    if (isChat) {

      // Geçerli bir konuşma seçili değilse ilk eşleşmeyi aç
      const people = matchedCandidates();

      if (!people.some(c => Number(c.id) === Number(S.chat))) {
        S.chat = people.length ? Number(people[0].id) : null;
      }

      renderChatContacts();
      drawChat();

    } else {

      document.getElementById("chatLayout")
        .classList.remove("chat-mobile-open");

      renderApp();
    }
  }


  // Eşleşmeler sekmesine basınca
  matchesButton.onclick = () => {
    switchTab("matches");
  };


  // Sohbet sekmesine basınca
  chatsButton.onclick = () => {

    document.getElementById("chatLayout")
      .classList.remove("chat-mobile-open");

    switchTab("chat");
  };


  // =========================================
  // SOHBETE GİT BUTONU
  // =========================================

  // Eski openChat fonksiyonunu değiştiriyoruz.
  // Artık ayrı sayfaya değil Sohbet sekmesine geçecek.

  openChat = function (id) {

    const matched = matchedCandidates().some(
      c => Number(c.id) === Number(id)
    );

    if (!matched) {
      toast("Sohbet için karşılıklı eşleşmeniz gerekiyor.");
      return;
    }

    S.chat = Number(id);

    show("sApp");
    changeMainPage("matches");

    switchTab("chat");

    // Mobilde doğrudan seçilen konuşmayı aç
    document.getElementById("chatLayout")
      .classList.add("chat-mobile-open");
  };


  // =========================================
  // EŞLEŞMELERE GERİ DÖN
  // =========================================

  document.getElementById("chatBack").onclick = () => {

    S.tab = "esl";

    switchTab("matches");
  };


  // =========================================
  // ANA MENÜYLE UYUMLULUK
  // =========================================

  const previousChangeMainPage = changeMainPage;

  changeMainPage = function (name) {

    previousChangeMainPage(name);

    if (name === "matches") {
      switchTab(activeTab);
    }
  };


  // Başlangıçta eşleşmeler ekranını göster
  switchTab("matches");

})();
