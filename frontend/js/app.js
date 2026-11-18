
const $ = id => document.getElementById(id);

// Mevcut temsili eşleşme verileri
const hr = (a, b) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const candRate = (c, f) => {
  if (hr(c, f) < .35) return 0;
  const q = 1 + hr(f, 7) * 4;
  return Math.max(1, Math.min(5,
    Math.round(q + (hr(c, f + 50) - .5) * 3)));
};

const S = {
  p: null,
  order: [],
  pos: 0,
  rt: {},
  mode: "onb",
  page: "matches",
  tab: "adaylar",
  act: {},
  msgs: {},
  scores: {},
  chat: null
};

let onboardingInProgress = false;
let selectedRating = null;

// Film verilerini Supabase'den yükle
async function initializeMovies() {
  const success = await loadMovies();

  if (!success || FILMS.length === 0) {
    console.error("Movies could not be loaded.");
    return;
  }

  S.order = FILMS.map(f => f.id);
  S.pos = 0;
}

const SECS = ["sInfo", "sVote", "sLogin", "sApp", "sChat"];

function show(id) {
  SECS.forEach(s => $(s).classList.toggle("hide", s !== id));
  window.scrollTo(0, 0);
}

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.style.opacity = 1;
  setTimeout(() => element.style.opacity = 0, 2200);
}

const rated = () => Object.values(S.rt).filter(v => v > 0).length;

// -----------------------
// ONBOARDING
// -----------------------

function savePendingOnboarding() {
  if (!S.p || rated() < 10) return;

  localStorage.setItem(
    "filmBuddyPendingOnboarding",
    JSON.stringify({
      profile: S.p,
      ratings: S.rt
    })
  );
}

function prepareOnboardingData() {
  const saved = localStorage.getItem("filmBuddyPendingOnboarding");
  if (!saved) return null;

  const pending = JSON.parse(saved);
  const p = pending.profile;

  return {
    profile: {
      first_name: p.ad,
      last_name: p.soyad,
      age: p.yas,
      gender: p.cins,
      city: p.sehir
    },
    ratings: Object.entries(pending.ratings).map(([movieId, rating]) => ({
      movie_id: Number(movieId),
      rating: rating === 0 ? null : rating
    }))
  };
}

async function submitOnboarding() {
  const payload = prepareOnboardingData();

  if (!payload) {
    console.error("No onboarding data found.");
    return;
  }

  const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.getUser();

  if (sessionError || !sessionData.user) {
    console.error("User is not authenticated.");
    return;
  }

  const { data, error } = await supabaseClient.rpc(
    "save_onboarding",
    {
      p_profile: payload.profile,
      p_ratings: payload.ratings
    }
  );

  if (error) {
    console.error("Onboarding error:", error);
    return;
  }

  console.log("Onboarding saved:", data);

  localStorage.removeItem("filmBuddyPendingOnboarding");

  $("ad").value = "";
  $("soyad").value = "";
  $("yas").value = "";
  $("cins").value = "";
  $("sehir").value = "";
}

// -----------------------
// TEMEL BİLGİLER
// -----------------------

$("go1").onclick = () => {
  const p = {
    ad: $("ad").value.trim(),
    soyad: $("soyad").value.trim(),
    yas: Number($("yas").value),
    cins: $("cins").value,
    sehir: $("sehir").value.trim()
  };

  if (!p.ad || !p.soyad || !p.yas || !p.cins || !p.sehir) {
    $("e1").textContent = "Lütfen tüm alanları doldur.";
    return;
  }

  if (p.yas < 18 || p.yas > 99) {
    $("e1").textContent = "Şimdilik 18 yaş ve üzeri kullanabilir.";
    return;
  }

  S.p = p;
  $("e1").textContent = "";
  S.mode = "onb";
  show("sVote");
  renderFilm();
};

// -----------------------
// FİLM OYLAMA
// -----------------------

function poster(f) {
  if (!f.poster_url) {
    return '<div class="poster">Afiş bulunamadı</div>';
  }

  const img = document.createElement("img");
  img.className = "poster";
  img.src = f.poster_url;
  img.alt = "Film afişi";
  img.loading = "lazy";

  return img.outerHTML;
}

function renderFilm() {
  const f = FILMS.find(movie => movie.id === S.order[S.pos]);

  if (!f) {
    toast("Filmler henüz yüklenmedi.");
    return;
  }

  selectedRating = S.rt[f.id] ?? null;

  const value = S.rt[f.id];
  const n = rated();
  const onb = S.mode === "onb";

  $("cnt").textContent = onb
    ? `Eşleşmeye kalan: ${Math.max(0, 10 - n)}`
    : `Oylanan film: ${n}`;

  $("prog").style.width = onb
    ? Math.min(100, n * 10) + "%"
    : "100%";

  $("exit").classList.toggle("hide", onb);
  $("updRow").classList.toggle("hide", onb);

  $("poster").innerHTML = poster(f);
  $("ft").textContent = f.t;
  $("fs").textContent = `${f.y} · ${f.g} · ${f.d} dk`;
  $("fd").textContent =
    "Yönetmen, oyuncular ve kısa özet burada yer alacak (temsili).";

  $("rate").innerHTML = [1, 2, 3, 4, 5]
    .map(k =>
      `<button data-v="${k}" class="${value === k ? "sel" : ""}">${k}</button>`
    ).join("");

  $("skip").classList.toggle("sel", value === 0);
  $("prev").disabled = S.pos === 0;
  $("next").disabled = false;
}

function vote(value) {
  if (onboardingInProgress) return;

  selectedRating = value;

  $("rate").querySelectorAll("button").forEach(button => {
    button.classList.toggle(
      "sel",
      Number(button.dataset.v) === value
    );
  });

  $("skip").classList.toggle("sel", value === 0);
}

$("rate").onclick = event => {
  const button = event.target.closest("button");
  if (button) vote(Number(button.dataset.v));
};

$("skip").onclick = () => vote(0);

$("prev").onclick = () => {
  if (onboardingInProgress) return;

  if (S.pos > 0) {
    S.pos--;
    renderFilm();
  }
};

$("next").onclick = async () => {
  if (onboardingInProgress) return;

  if (selectedRating === null) {
    toast("Önce bir puan seç veya İzlemedim'e bas.");
    return;
  }

  const movieId = S.order[S.pos];

  // Kayıtlı kullanıcıların yeni oylarını Supabase'e de yaz
  if (S.mode === "more") {
    onboardingInProgress = true;
    try {
      const saved = await saveMovieRating(movieId, selectedRating);

      if (!saved) {
        toast("Film puanı kaydedilemedi.");
        return;
      }
    } finally {
      onboardingInProgress = false;
    }
  }

  S.rt[movieId] = selectedRating;

  if (S.mode === "onb" && rated() >= 10) {
    onboardingInProgress = true;
    savePendingOnboarding();

    try {
      const { data, error } = await supabaseClient.auth.getUser();

      if (error || !data?.user) {
        show("sLogin");
        return;
      }

      await submitOnboarding();

      if (localStorage.getItem("filmBuddyPendingOnboarding")) {
        toast("Profil kaydedilemedi.");
        return;
      }

      S.mode = "more";
      S.tab = "adaylar";
      calc();
      show("sApp");
      changeMainPage("matches");

    } catch (error) {
      console.error("Onboarding failed:", error);
      toast("Kayıt sırasında hata oluştu.");
    } finally {
      onboardingInProgress = false;
    }

    return;
  }

  if (S.pos < S.order.length - 1) {
    S.pos++;
    renderFilm();
  } else {
    toast("Tüm filmleri oyladın.");
  }
};

$("exit").onclick = () => {
  show("sApp");
  changeMainPage(S.page);
};

$("upd").onclick = () => {
  calc();
  show("sApp");
  changeMainPage("matches");
  toast("Eşleşmeler güncellendi.");
};

// -----------------------
// GOOGLE OAUTH
// -----------------------

async function startGoogleLogin(button) {
  button.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      console.error("Google login error:", error);
      toast("Google ile giriş başlatılamadı.");
    }
  } catch (error) {
    console.error("Google login failed:", error);
    toast("Giriş sırasında bir hata oluştu.");
  } finally {
    button.disabled = false;
  }
}

$("googleLogin").onclick = async () => {
  if (rated() < 10) {
    toast("En az 10 filme puan vermelisin.");
    return;
  }

  await startGoogleLogin($("googleLogin"));
};

$("existingLogin").onclick = async () => {
  localStorage.removeItem("filmBuddyPendingOnboarding");
  await startGoogleLogin($("existingLogin"));
};

// -----------------------
// EŞLEŞMELER
// -----------------------

function calc() {
  CANDS.forEach(c => {
    let shared = 0;
    let difference = 0;

    Object.keys(S.rt).forEach(fid => {
      const myRating = S.rt[fid];

      if (myRating > 0) {
        const otherRating = candRate(c.id, Number(fid));

        if (otherRating > 0) {
          shared++;
          difference += Math.abs(myRating - otherRating);
        }
      }
    });

    S.scores[c.id] = shared
      ? Math.round(100 * (1 - difference / shared / 4) *
          (.6 + .4 * Math.min(1, shared / 6)))
      : 0;

    c.shared = shared;
  });
}

function ring(score) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;

  return `
    <div class="ring">
      <svg width="62" height="62">
        <circle cx="31" cy="31" r="${radius}"
          fill="none" stroke="var(--bd)" stroke-width="6"/>
        <circle cx="31" cy="31" r="${radius}"
          fill="none" stroke="var(--hi)" stroke-width="6"
          stroke-linecap="round"
          stroke-dasharray="${circumference * score / 100} ${circumference}"/>
      </svg>
      <span>%${score}</span>
    </div>
  `;
}

const fname = candidate => candidate.n;

function lists() {
  const sorted = [...CANDS].sort(
    (a, b) => S.scores[b.id] - S.scores[a.id]
  );

  return {
    adaylar: sorted.filter(c => !S.act[c.id]),
    ilgi: sorted.filter(c => c.likesYou && !S.act[c.id]),
    esl: sorted.filter(c => S.act[c.id] === "match")
  };
}

function card(c, kind, first) {
  const score = S.scores[c.id];
  let buttons = "";

  if (kind === "esl") {
    buttons = `
      <div class="acts">
        <button class="pri" data-a="chat" data-c="${c.id}">
          Sohbete git
        </button>
      </div>`;
  } else {
    buttons = `
      <div class="acts">
        <button data-a="pass" data-c="${c.id}">Geç</button>
        <button class="pri" data-a="like" data-c="${c.id}">
          ${kind === "ilgi" ? "Kabul et" : "İlgileniyorum"}
        </button>
      </div>
      ${kind === "adaylar" ? `
        <button class="lnk" data-a="note" data-c="${c.id}">
          Not yazarak ilgi gönder
        </button>
        <div class="hide" id="nt${c.id}">
          <textarea rows="2" maxlength="200" id="ni${c.id}"
            placeholder="Kısa bir not yaz..."
            style="margin-top:8px"></textarea>
          <div class="row" style="margin-top:8px">
            <button class="pri" data-a="sendnote" data-c="${c.id}">
              Notla gönder
            </button>
          </div>
        </div>` : ""}`;
  }

  return `
    <div class="card cand">
      ${first && kind === "adaylar" && score > 0
        ? '<div class="best">★ Listenizdeki en yüksek uyum</div>'
        : ""}
      <div class="hd">
        <div>
          <div class="nm">${fname(c)}</div>
          <div class="sub">${c.a} yaş · ${c.c}</div>
          ${kind === "ilgi"
            ? '<span class="chip">Size ilgi gönderdi</span>'
            : `<span class="sub" style="display:block;margin-top:8px">
                 ${c.shared} ortak oylanan film
               </span>`}
        </div>
        ${ring(score)}
      </div>
      ${buttons}
    </div>`;
}

function renderApp() {
  const listsData = lists();

  $("hello").textContent =
    `Merhaba ${S.p?.ad || "filmsever"} 👋`;

  const tabs = [
    ["adaylar", "Adaylar", listsData.adaylar.length],
    ["ilgi", "Size ilgi", listsData.ilgi.length],
    ["esl", "Eşleşmeler", listsData.esl.length]
  ];

  $("tabs").innerHTML = tabs.map(tab => `
    <button data-t="${tab[0]}"
      class="${S.tab === tab[0] ? "on" : ""}">
      ${tab[1]}<b>${tab[2] || ""}</b>
    </button>
  `).join("");

  const candidates = listsData[S.tab];

  let heading = "";

  if (S.tab === "adaylar") {
    heading = `
      <div class="top" style="margin-bottom:10px">
        <div>
          <h2>Bugün ${candidates.length} aday</h2>
          <p style="margin:0">
            Birbirinize “İlgileniyorum” dediğinizde eşleşirsiniz.
          </p>
        </div>
      </div>
      <div class="box" style="margin-bottom:14px">
        <span>
          Daha iyi eşleşme için daha fazla film oyla,
          sonra eşleşmeleri güncelle.
        </span>
      </div>`;
  } else if (S.tab === "ilgi") {
    heading = '<h2 style="margin-bottom:10px">Size ilgi gösterenler</h2>';
  } else {
    heading = '<h2 style="margin-bottom:10px">Eşleşmelerin</h2>';
  }

  const emptyMessage = S.tab === "esl"
    ? "Henüz eşleşme yok. İki taraf da ilgilendiğinde burada sohbet açılır."
    : "Şimdilik kimse yok. Daha fazla film oyla, eşleşmeleri güncelle.";

  $("list").innerHTML = heading + (
    candidates.length
      ? `<div class="cards">
          ${candidates.map((c, i) =>
            card(c, S.tab, i === 0)).join("")}
         </div>`
      : `<div class="empty">${emptyMessage}</div>`
  );
}

$("tabs").onclick = event => {
  const button = event.target.closest("button");

  if (button) {
    S.tab = button.dataset.t;
    renderApp();
  }
};

$("more").onclick = continueVoting;

$("logout").onclick = async () => {
  const button = $("logout");
  button.disabled = true;

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      toast("Çıkış yapılamadı.");
      return;
    }

    S.p = {};
    S.rt = {};
    S.act = {};
    S.msgs = {};
    S.scores = {};
    S.chat = null;
    S.pos = 0;
    S.mode = "onb";
    S.tab = "adaylar";
    S.page = "matches";

    localStorage.removeItem("filmBuddyPendingOnboarding");
    show("sInfo");

  } catch (error) {
    console.error("Logout failed:", error);
    toast("Çıkış sırasında bir hata oluştu.");
  } finally {
    button.disabled = false;
  }
};

$("list").onclick = event => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = Number(button.dataset.c);
  const action = button.dataset.a;
  const candidate = CANDS[id];

  if (action === "pass") {
    S.act[id] = "pass";
  } else if (action === "like" || action === "sendnote") {
    if (candidate.likesYou) {
      S.act[id] = "match";
      toast(`${candidate.n} ile eşleştiniz! 🎉`);
    } else {
      S.act[id] = "sent";
      toast("İlgin gönderildi");
    }
  } else if (action === "note") {
    $("nt" + id).classList.toggle("hide");
    return;
  } else if (action === "chat") {
    openChat(id);
    return;
  }

  renderApp();
};

// -----------------------
// SOHBET
// -----------------------

function openChat(id) {
  S.chat = id;
  $("chatTitle").textContent = CANDS[id].n;
  S.msgs[id] = S.msgs[id] || [];
  drawChat();
  show("sChat");
}

function drawChat() {
  const messages = S.msgs[S.chat];

  $("chatBox").innerHTML = messages.length
    ? messages.map(x =>
        `<div class="msg ${x.me ? "me" : ""}"></div>`
      ).join("")
    : '<div class="empty">Eşleştiniz! İlk mesajı sen yaz.</div>';

  [...$("chatBox").querySelectorAll(".msg")].forEach((element, i) => {
    element.textContent = messages[i].t;
  });

  $("chatBox").scrollTop = 1e6;
}

function send() {
  const text = $("chatIn").value.trim();
  if (!text) return;

  S.msgs[S.chat].push({ me: 1, t: text });
  $("chatIn").value = "";
  drawChat();
}

$("chatSend").onclick = send;

$("chatIn").onkeydown = event => {
  if (event.key === "Enter") send();
};

$("chatBack").onclick = () => {
  S.tab = "esl";
  show("sApp");
  changeMainPage("matches");
};

// -----------------------
// ANA MENÜ
// -----------------------

function changeMainPage(page) {
  S.page = page;

  ["matches", "votes", "profile"].forEach(name => {
    const cap = name[0].toUpperCase() + name.slice(1);

    $("page" + cap).classList.toggle("hide", page !== name);
    $("menu" + cap).classList.toggle("active", page === name);
  });

  if (page === "matches") renderApp();
  if (page === "votes") renderVoteHistory();
  if (page === "profile") renderProfile();
}

$("menuMatches").onclick = () => changeMainPage("matches");
$("menuVotes").onclick = () => changeMainPage("votes");
$("menuProfile").onclick = () => changeMainPage("profile");

function continueVoting() {
  S.mode = "more";

  const next = S.order.findIndex(id => S.rt[id] === undefined);
  S.pos = next < 0 ? 0 : next;

  show("sVote");
  renderFilm();
}

$("voteMore").onclick = continueVoting;

// -----------------------
// OYLAMALARIM - FİLM GALERİSİ
// -----------------------

function renderVoteHistory() {
  const container = $("voteHistory");
  container.replaceChildren();

  const movies = FILMS.filter(f => S.rt[f.id] !== undefined);

  $("voteSummary").textContent =
    `${rated()} puanlı film · ${movies.filter(f => S.rt[f.id] === 0).length} izlemedim`;

  if (!movies.length) {
    container.innerHTML =
      '<div class="empty">Henüz film oylamadın.</div>';
    return;
  }

  const grid = document.createElement("div");
  grid.className = "vote-grid";

  movies.forEach(f => {
    const value = Number(S.rt[f.id]);

    const tile = document.createElement("article");
    tile.className = "vote-tile";

    const posterWrap = document.createElement("div");
    posterWrap.className = "vote-tile-poster";

    if (f.poster_url) {
      const img = document.createElement("img");
      img.src = f.poster_url;
      img.alt = f.t + " afişi";
      img.loading = "lazy";
      posterWrap.append(img);
    } else {
      posterWrap.textContent = "Afiş bulunamadı";
    }

    const info = document.createElement("div");
    info.className = "vote-tile-info";

    const title = document.createElement("h3");
    title.textContent = f.t;

    const year = document.createElement("p");
    year.textContent = f.y || "";

    const stars = document.createElement("div");
    stars.className = "vote-stars";
    stars.textContent = value === 0
      ? "İzlemedim"
      : "★".repeat(value) + "☆".repeat(5 - value);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "vote-edit";
    edit.textContent = "✏️ Puanı düzenle";
    edit.onclick = () => openRatingModal(f.id);

    info.append(title, year, stars, edit);
    tile.append(posterWrap, info);
    grid.append(tile);
  });

  container.append(grid);
}

// -----------------------
// PUAN DÜZENLEME MODALI
// -----------------------

let editingMovieId = null;
let editingRating = null;
let ratingSaving = false;
let ratingPreviousFocus = null;

function selectModalRating(value) {
  if (ratingSaving) return;

  editingRating = value;

  $("ratingChoices").querySelectorAll("button").forEach(button => {
    const selected = Number(button.dataset.rating) === value;
    button.classList.toggle("sel", selected);
    button.setAttribute("aria-pressed", String(selected));
  });

  const notWatched = value === 0;
  $("ratingNotWatched").classList.toggle("sel", notWatched);
  $("ratingNotWatched").setAttribute("aria-pressed", String(notWatched));
  $("ratingError").textContent = "";
}

function openRatingModal(movieId) {
  const movie = FILMS.find(f => String(f.id) === String(movieId));
  if (!movie) return;

  editingMovieId = movie.id;
  ratingPreviousFocus = document.activeElement;

  $("ratingModalTitle").textContent = movie.t;
  $("ratingModalMeta").textContent =
    [movie.y, movie.g, movie.d ? movie.d + " dk" : ""]
      .filter(Boolean).join(" · ");

  $("ratingCurrent").textContent =
    Number(S.rt[movie.id]) === 0
      ? "Mevcut seçim: İzlemedim"
      : `Mevcut puanın: ${S.rt[movie.id]}/5`;

  const posterContainer = $("ratingPoster");
  posterContainer.replaceChildren();

  if (movie.poster_url) {
    const img = document.createElement("img");
    img.src = movie.poster_url;
    img.alt = movie.t + " afişi";
    posterContainer.append(img);
  } else {
    posterContainer.textContent = "Afiş bulunamadı";
  }

  $("ratingChoices").replaceChildren();

  for (let rating = 1; rating <= 5; rating++) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.rating = String(rating);
    button.textContent = String(rating);
    button.onclick = () => selectModalRating(rating);
    $("ratingChoices").append(button);
  }

  $("ratingError").textContent = "";
  $("ratingModal").classList.remove("hide");
  document.body.classList.add("rating-modal-open");

  selectModalRating(Number(S.rt[movie.id]));
  $("ratingClose").focus();
}

function closeRatingModal() {
  if (ratingSaving) return;

  $("ratingModal").classList.add("hide");
  document.body.classList.remove("rating-modal-open");

  editingMovieId = null;
  editingRating = null;

  if (ratingPreviousFocus && ratingPreviousFocus.isConnected) {
    ratingPreviousFocus.focus();
  }
}

$("ratingNotWatched").onclick = () => selectModalRating(0);
$("ratingClose").onclick = closeRatingModal;
$("ratingCancel").onclick = closeRatingModal;
$("ratingBackdrop").onclick = closeRatingModal;

$("ratingModal").addEventListener("keydown", event => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeRatingModal();
  }

  if (event.key === "Tab") {
    const controls = [
      ...$("ratingModal").querySelectorAll("button:not(:disabled)")
    ];

    if (!controls.length) return;

    if (event.shiftKey && document.activeElement === controls[0]) {
      event.preventDefault();
      controls[controls.length - 1].focus();
    } else if (!event.shiftKey &&
               document.activeElement === controls[controls.length - 1]) {
      event.preventDefault();
      controls[0].focus();
    }
  }
});

$("ratingSave").onclick = async () => {
  if (ratingSaving || editingMovieId === null) return;

  if (editingRating === null) {
    $("ratingError").textContent = "Lütfen bir puan seç.";
    return;
  }

  ratingSaving = true;

  const button = $("ratingSave");
  button.disabled = true;
  button.textContent = "Kaydediliyor...";

  try {
    const saved = await saveMovieRating(
      editingMovieId,
      editingRating
    );

    if (!saved) {
      $("ratingError").textContent =
        "Puan kaydedilemedi. Lütfen tekrar dene.";
      return;
    }

    S.rt[editingMovieId] = editingRating;

    ratingSaving = false;
    closeRatingModal();
    renderVoteHistory();

    toast("Film puanın güncellendi.");
  } catch (error) {
    console.error("Rating update failed:", error);
    $("ratingError").textContent = "Puan güncellenemedi.";
  } finally {
    ratingSaving = false;
    button.disabled = false;
    button.textContent = "Puanı Güncelle";
  }
};

// -----------------------
// SUPABASE - FİLM PUANI KAYDET
// -----------------------

async function saveMovieRating(movieId, rating) {
  try {
    const { data, error: authError } =
      await supabaseClient.auth.getUser();

    if (authError || !data?.user) return false;

    const { error } = await supabaseClient
      .from("user_movies")
      .upsert(
        {
          user_id: data.user.id,
          movie_id: movieId,
          rating: rating === 0 ? null : rating
        },
        {
          onConflict: "user_id,movie_id"
        }
      );

    if (error) {
      console.error("Rating save error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Rating save failed:", error);
    return false;
  }
}

// -----------------------
// PROFİL
// -----------------------

function renderProfile() {
  if (!S.p) return;

  $("profileName").value = S.p.ad || "";
  $("profileSurname").value = S.p.soyad || "";
  $("profileAge").value = S.p.yas || "";
  $("profileGender").value =
    S.p.cins || "Belirtmek istemiyorum";
  $("profileCity").value = S.p.sehir || "";
}

$("saveProfile").onclick = async () => {
  const updated = {
    ad: $("profileName").value.trim(),
    soyad: $("profileSurname").value.trim(),
    yas: Number($("profileAge").value),
    cins: $("profileGender").value,
    sehir: $("profileCity").value.trim()
  };

  if (!updated.ad || !updated.soyad ||
      !updated.sehir || !updated.cins ||
      !Number.isInteger(updated.yas) ||
      updated.yas < 18 || updated.yas > 99) {
    $("profileError").textContent =
      "Lütfen geçerli bilgileri gir.";
    return;
  }

  const button = $("saveProfile");
  button.disabled = true;
  $("profileError").textContent = "";

  try {
    const { data, error: authError } =
      await supabaseClient.auth.getUser();

    if (authError || !data?.user) {
      throw new Error("Oturum bulunamadı.");
    }

    const { error } = await supabaseClient
      .from("profiles")
      .update({
        first_name: updated.ad,
        last_name: updated.soyad,
        age: updated.yas,
        gender: updated.cins,
        city: updated.sehir
      })
      .eq("id", data.user.id);

    if (error) throw error;

    S.p = updated;
    $("hello").textContent = `Merhaba ${S.p.ad} 👋`;
    toast("Profil bilgilerin kaydedildi.");

  } catch (error) {
    console.error("Profile update failed:", error);
    $("profileError").textContent =
      "Profil kaydedilemedi. Supabase izinlerini kontrol edin.";
  } finally {
    button.disabled = false;
  }
};

// -----------------------
// OTURUM KONTROLÜ
// -----------------------

async function checkAuthSession() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data?.user) {
    console.log("No active session.");
    show("sInfo");
    return;
  }

  const user = data.user;
  console.log("Login successful!");

  const { data: existingProfile, error: existingError } =
    await supabaseClient
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

  if (existingError) {
    console.error("Profile check failed:", existingError);
    return;
  }

  if (existingProfile) {
    localStorage.removeItem("filmBuddyPendingOnboarding");
    console.log("Existing user detected.");
  }

  const pending = existingProfile
    ? null
    : localStorage.getItem("filmBuddyPendingOnboarding");

  if (!existingProfile && !pending) {
    S.p = null;
    S.rt = {};
    S.mode = "onb";
    S.pos = 0;

    show("sInfo");
    toast("Hoş geldin! Profilini oluştur ve 10 film puanla.");
    return;
  }

  if (pending) {
    try {
      const saved = JSON.parse(pending);

      if (!saved.profile || !saved.ratings) {
        console.error("Incomplete onboarding data.");
        return;
      }

      const ratedCount = Object.values(saved.ratings)
        .filter(rating => Number(rating) >= 1 &&
                          Number(rating) <= 5).length;

      if (ratedCount < 10) {
        console.error("At least 10 movie ratings are required.");
        return;
      }

      S.p = saved.profile;
      S.rt = saved.ratings;

      await submitOnboarding();

      if (localStorage.getItem("filmBuddyPendingOnboarding")) {
        console.error("Onboarding save failed.");
        return;
      }
    } catch (error) {
      console.error("Onboarding error:", error);
      return;
    }

  } else {
    const { data: profile, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("first_name, last_name, age, gender, city")
        .eq("id", user.id)
        .maybeSingle();

    if (profileError || !profile) {
      console.error("Profile not found:", profileError);
      return;
    }

    const { data: ratings, error: ratingsError } =
      await supabaseClient
        .from("user_movies")
        .select("movie_id, rating")
        .eq("user_id", user.id);

    if (ratingsError) {
      console.error("Ratings error:", ratingsError);
      return;
    }

    const ratedCount = ratings.filter(
      item => item.rating >= 1 && item.rating <= 5
    ).length;

    if (ratedCount < 10) {
      console.error("User has fewer than 10 rated movies.");
      return;
    }

    S.p = {
      ad: profile.first_name,
      soyad: profile.last_name,
      yas: profile.age,
      cins: profile.gender,
      sehir: profile.city
    };

    S.rt = Object.fromEntries(
      ratings.map(item => [
        item.movie_id,
        item.rating ?? 0
      ])
    );

    console.log("Existing profile loaded!");
  }

  S.mode = "more";
  S.tab = "adaylar";

  calc();
  show("sApp");
  changeMainPage("matches");

  console.log("Session restored successfully!");
}

// Önce film verileri, sonra kullanıcı oturumu
async function startApp() {
  try {
    await initializeMovies();
    await checkAuthSession();
  } catch (error) {
    console.error("App initialization failed:", error);
    toast("Uygulama başlatılamadı.");
    show("sInfo");
  }
}

startApp();
