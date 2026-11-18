// ---- Temsili veri (sonra Supabase'deki movies / profiles tablolarından gelecek) ----
const $=id=>document.getElementById(id);
const hr=(a,b)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x)};
const candRate=(c,f)=>{if(hr(c,f)<.35)return 0;const q=1+hr(f,7)*4;return Math.max(1,Math.min(5,Math.round(q+(hr(c,f+50)-.5)*3)))};
const S={p:null,order:[],pos:0,rt:{},mode:"onb",page:"matches",tab:"adaylar",act:{},msgs:{},scores:{},chat:null};

// Load movies before starting the app
async function initializeMovies() {
  const success = await loadMovies();

  if (!success || FILMS.length === 0) {
    console.error("Movies could not be loaded.");
    return;
  }

  S.order = FILMS.map(f => f.id);

  // Start with the first movie
  S.pos = 0;
}

initializeMovies();

const SECS=["sInfo","sVote","sLogin","sApp","sChat"];
const show=id=>{SECS.forEach(s=>$(s).classList.toggle("hide",s!==id));window.scrollTo(0,0)};
function toast(t){const e=$("toast");e.textContent=t;e.style.opacity=1;setTimeout(()=>e.style.opacity=0,2200)}
const rated=()=>Object.values(S.rt).filter(v=>v>0).length;

// Save onboarding data before email login
function savePendingOnboarding() {
  if (!S.p || rated() < 10) return;

  const pending = {
    profile: S.p,
    ratings: S.rt
  };

  localStorage.setItem(
    "filmBuddyPendingOnboarding",
    JSON.stringify(pending)
  );
}


// Convert local onboarding data to backend format
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


// Save onboarding data to Supabase
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

  // Clear pending data only after success
  localStorage.removeItem("filmBuddyPendingOnboarding");

// Clear profile form fields
$("ad").value = "";
$("soyad").value = "";
$("yas").value = "";
$("cins").value = "";
$("sehir").value = "";

}




// ---- 1. Temel bilgiler ----
$("go1").onclick=()=>{
  const p={ad:$("ad").value.trim(),soyad:$("soyad").value.trim(),yas:+$("yas").value,cins:$("cins").value,sehir:$("sehir").value.trim()};
  if(!p.ad||!p.soyad||!p.yas||!p.cins||!p.sehir){$("e1").textContent="Lütfen tüm alanları doldur.";return}
  if(p.yas<18||p.yas>99){$("e1").textContent="Şimdilik 18 yaş ve üzeri kullanabilir.";return}
  S.p=p;$("e1").textContent="";S.mode="onb";show("sVote");renderFilm();
};

// ---- 2. Film oylama ----

// Show the real movie poster
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

    const v = S.rt[f.id];
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
    $("fd").textContent = "Yönetmen, oyuncular ve kısa özet burada yer alacak (temsili).";

    $("rate").innerHTML = [1, 2, 3, 4, 5]
        .map(k => `<button data-v="${k}" class="${v === k ? "sel" : ""}">${k}</button>`)
        .join("");

    $("skip").classList.toggle("sel", v === 0);

    $("prev").disabled = S.pos === 0;
    $("next").disabled = false;
}

let selectedRating = null;
// Kullanıcı puan seçtiğinde sadece işaretle
function vote(v) {
    selectedRating = v;
    $("rate").querySelectorAll("button").forEach(button => {
        button.classList.toggle(
            "sel",
            Number(button.dataset.v) === v
        );
    });
    $("skip").classList.toggle("sel", v === 0);
}

// 1-5 arası puanlama
$("rate").onclick = e => {
    const button = e.target.closest("button");
    if (button) {
        vote(Number(button.dataset.v));
    }
};
// İzlemedim butonu
$("skip").onclick = () => {
    vote(0);
};
// Geri butonu
$("prev").onclick = () => {
    if (S.pos > 0) {
        S.pos--;
        renderFilm();
    }
};
// İleri butonu
$("next").onclick = () => {
    if (selectedRating === null) {
        toast("Önce bir puan seç veya İzlemedim'e bas.");
        return;
    }
    // Seçilen puanı kaydet
    S.rt[S.order[S.pos]] = selectedRating;
    // İlk 10 film tamamlandıysa giriş ekranına geç
    if (S.mode === "onb" && rated() >= 10) {
        savePendingOnboarding();
        show("sLogin");
        return;
    }
    // Sonraki filme geç
    if (S.pos < S.order.length - 1) {
        S.pos++;
        renderFilm();
    } else {
        toast("Tüm filmleri oyladın.");
    }
};

// Oylama ekranından çık
$("exit").onclick = () => {
    show("sApp");
    changeMainPage(S.page);
};

// Eşleşmeleri güncelle
$("upd").onclick = () => {
    calc();
    show("sApp");
    changeMainPage("matches");
    toast("Eşleşmeler güncellendi");
};

// Start Google OAuth
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

// Sign up after rating 10 movies
$("googleLogin").onclick = async () => {
  if (rated() < 10) {
    toast("En az 10 filme puan vermelisin.");
    return;
  }

  await startGoogleLogin($("googleLogin"));
};

// Sign in with an existing account
$("existingLogin").onclick = async () => {
  // Do not reuse previous onboarding data
  localStorage.removeItem("filmBuddyPendingOnboarding");

  await startGoogleLogin($("existingLogin"));
};



// ---- 4. Eşleşme sayfası ----
function calc(){
  CANDS.forEach(c=>{
    let sh=0,d=0;
    Object.keys(S.rt).forEach(fid=>{const m=S.rt[fid];if(m>0){const o=candRate(c.id,+fid);if(o>0){sh++;d+=Math.abs(m-o)}}});
    S.scores[c.id]=sh?Math.round(100*(1-d/sh/4)*(.6+.4*Math.min(1,sh/6))):0;
    c.shared=sh;
  });
}
const ring=s=>{const r=26,c=2*Math.PI*r;return `<div class="ring"><svg width="62" height="62"><circle cx="31" cy="31" r="${r}" fill="none" stroke="var(--bd)" stroke-width="6"/><circle cx="31" cy="31" r="${r}" fill="none" stroke="var(--hi)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c*s/100} ${c}"/></svg><span>%${s}</span></div>`};
const fname=c=>c.n;
function lists(){
  const sorted=[...CANDS].sort((a,b)=>S.scores[b.id]-S.scores[a.id]);
  return{
    adaylar:sorted.filter(c=>!S.act[c.id]),
    ilgi:sorted.filter(c=>c.likesYou&&!S.act[c.id]),
    esl:sorted.filter(c=>S.act[c.id]==="match")
  };
}
function card(c,kind,first){
  const s=S.scores[c.id];
  let btn="";
  if(kind==="esl")btn=`<div class="acts"><button class="pri" data-a="chat" data-c="${c.id}">Sohbete git</button></div>`;
  else btn=`<div class="acts"><button data-a="pass" data-c="${c.id}">Geç</button><button class="pri" data-a="like" data-c="${c.id}">${kind==="ilgi"?"Kabul et":"İlgileniyorum"}</button></div>
  ${kind==="adaylar"?`<button class="lnk" data-a="note" data-c="${c.id}">Not yazarak ilgi gönder</button><div class="hide" id="nt${c.id}"><textarea rows="2" maxlength="200" id="ni${c.id}" placeholder="Kısa bir not yaz..." style="margin-top:8px"></textarea><div class="row" style="margin-top:8px"><button class="pri" data-a="sendnote" data-c="${c.id}">Notla gönder</button></div></div>`:""}`;
  return `<div class="card cand">${first&&kind==="adaylar"&&s>0?`<div class="best">★ Listenizdeki en yüksek uyum</div>`:""}
  <div class="hd"><div><div class="nm">${fname(c)}</div><div class="sub">${c.a} yaş · ${c.c}</div>${kind==="ilgi"?`<span class="chip">Size ilgi gönderdi</span>`:`<span class="sub" style="display:block;margin-top:8px">${c.shared} ortak oylanan film</span>`}</div>${ring(s)}</div>${btn}</div>`;
}
function renderApp(){
  const L=lists();
  $("hello").textContent=`Merhaba ${S.p?.ad || "filmsever"} 👋`;
  const T=[["adaylar","Adaylar",L.adaylar.length],["ilgi","Size ilgi",L.ilgi.length],["esl","Eşleşmeler",L.esl.length]];
  $("tabs").innerHTML=T.map(t=>`<button data-t="${t[0]}" class="${S.tab===t[0]?"on":""}">${t[1]}<b>${t[2]||""}</b></button>`).join("");
  const arr=L[S.tab],head=S.tab==="adaylar"?`<div class="top" style="margin-bottom:10px"><div><h2>Bugün ${arr.length} aday</h2><p style="margin:0">Birbirinize “İlgileniyorum” dediğinizde eşleşirsiniz.</p></div></div><div class="box" style="margin-bottom:14px"><span>Daha iyi eşleşme için daha fazla film oyla, sonra eşleşmeleri güncelle.</span></div>`:S.tab==="ilgi"?`<h2 style="margin-bottom:10px">Size ilgi gösterenler</h2>`:`<h2 style="margin-bottom:10px">Eşleşmelerin</h2>`;
  $("list").innerHTML=head+(arr.length?`<div class="cards">${arr.map((c,i)=>card(c,S.tab,i===0)).join("")}</div>`:`<div class="empty">${S.tab==="esl"?"Henüz eşleşme yok. İki taraf da ilgilendiğinde burada sohbet açılır.":"Şimdilik kimse yok. Daha fazla film oyla, eşleşmeleri güncelle."}</div>`);
}
$("tabs").onclick=e=>{const b=e.target.closest("button");if(b){S.tab=b.dataset.t;renderApp()}};
$("more").onclick=continueVoting;

// Sign out from Supabase
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

    // Clear user data from memory
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

    // Clear pending onboarding data
    localStorage.removeItem("filmBuddyPendingOnboarding");

    // Return to the welcome screen
    show("sInfo");

    console.log("Logout successful!");
  } catch (error) {
    console.error("Logout failed:", error);
    toast("Çıkış sırasında bir hata oluştu.");
  } finally {
    button.disabled = false;
  }
};

$("list").onclick=e=>{
  const b=e.target.closest("button");if(!b)return;
  const id=+b.dataset.c,a=b.dataset.a,c=CANDS[id];
  if(a==="pass")S.act[id]="pass";
  else if(a==="like"||a==="sendnote"){
    if(c.likesYou){S.act[id]="match";toast(`${c.n} ile eşleştiniz! 🎉`)}else{S.act[id]="sent";toast("İlgin gönderildi")}
  }else if(a==="note"){$("nt"+id).classList.toggle("hide");return}
  else if(a==="chat"){openChat(id);return}
  renderApp();
};

// ---- 5. Sohbet ----
function openChat(id){S.chat=id;$("chatTitle").textContent=CANDS[id].n;S.msgs[id]=S.msgs[id]||[];drawChat();show("sChat")}
function drawChat(){
  const m=S.msgs[S.chat];
  $("chatBox").innerHTML=m.length?m.map(x=>`<div class="msg ${x.me?"me":""}"></div>`).join(""):`<div class="empty">Eşleştiniz! İlk mesajı sen yaz.</div>`;
  [...$("chatBox").querySelectorAll(".msg")].forEach((el,i)=>el.textContent=m[i].t);
  $("chatBox").scrollTop=1e6;
}
function send(){const t=$("chatIn").value.trim();if(!t)return;S.msgs[S.chat].push({me:1,t});$("chatIn").value="";drawChat()}
$("chatSend").onclick=send;$("chatIn").onkeydown=e=>{if(e.key==="Enter")send()};
$("chatBack").onclick=()=>{S.tab="esl";show("sApp");changeMainPage("matches")};



// ---- Giriş sonrası ana menü, oylama geçmişi ve profil ----
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

function renderVoteHistory() {
  const container = $("voteHistory");
  container.replaceChildren();
  const movies = FILMS.filter(f => S.rt[f.id] !== undefined);
  $("voteSummary").textContent = `${rated()} puanlı film · ${movies.filter(f => S.rt[f.id] === 0).length} izlemedim`;
  if (!movies.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Henüz film oylamadın.";
    container.append(empty);
    return;
  }
  movies.forEach(f => {
    const value = Number(S.rt[f.id]);
    const card = document.createElement("div"); card.className = "vote-card";
    const img = document.createElement("img"); img.src = f.poster_url || ""; img.alt = f.t + " afişi"; img.loading = "lazy";
    const details = document.createElement("div"); details.className = "vote-details";
    const title = document.createElement("h3"); title.textContent = f.t;
    const year = document.createElement("p"); year.textContent = f.y || "";
    const stars = document.createElement("div"); stars.className = "vote-stars";
    stars.textContent = value === 0 ? "👁 İzlemedim" : "★".repeat(value) + "☆".repeat(5 - value);
    const edit = document.createElement("button"); edit.textContent = "✏️ Düzenle";
    edit.onclick = () => { S.pos = S.order.indexOf(f.id); S.mode = "more"; show("sVote"); renderFilm(); };
    details.append(title, year, stars); card.append(img, details, edit); container.append(card);
  });
}

// Existing user ratings are saved to the same table read by checkAuthSession.
async function saveMovieRating(movieId, rating) {
  try {
    const { data, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !data.user) return;
    const { error } = await supabaseClient.from("user_movies").upsert(
      { user_id: data.user.id, movie_id: movieId, rating: rating === 0 ? null : rating },
      { onConflict: "user_id,movie_id" }
    );
    if (error) { console.error("Rating save error:", error); toast("Puan sunucuya kaydedilemedi."); }
  } catch (error) { console.error("Rating save failed:", error); toast("Puan sunucuya kaydedilemedi."); }
}

async function renderProfile() {
  if (!S.p) return;
  $("profileName").value = S.p.ad || "";
  $("profileSurname").value = S.p.soyad || "";
  $("profileAge").value = S.p.yas || "";
  $("profileGender").value = S.p.cins || "Belirtmek istemiyorum";
  $("profileCity").value = S.p.sehir || "";
  const { data } = await supabaseClient.auth.getUser();
  if (S.page === "profile") $("profileEmail").value = data?.user?.email || "";
}
$("saveProfile").onclick = async () => {
  const updated = {
    ad: $("profileName").value.trim(), soyad: $("profileSurname").value.trim(),
    yas: Number($("profileAge").value), cins: $("profileGender").value,
    sehir: $("profileCity").value.trim()
  };
  if (!updated.ad || !updated.soyad || !updated.sehir || !updated.cins ||
      !Number.isInteger(updated.yas) || updated.yas < 18 || updated.yas > 99) {
    $("profileError").textContent = "Lütfen geçerli bilgileri gir.";
    return;
  }
  const button = $("saveProfile"); button.disabled = true;
  $("profileError").textContent = "";
  try {
    const { data, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !data.user) throw new Error("Oturum bulunamadı.");
    const { error } = await supabaseClient.from("profiles").update({
      first_name: updated.ad, last_name: updated.soyad, age: updated.yas,
      gender: updated.cins, city: updated.sehir
    }).eq("id", data.user.id);
    if (error) throw error;
    S.p = updated;
    $("hello").textContent = `Merhaba ${S.p.ad} 👋`;
    toast("Profil bilgilerin kaydedildi.");
  } catch (error) {
    console.error("Profile update failed:", error);
    $("profileError").textContent = "Profil kaydedilemedi. Supabase izinlerini kontrol edin.";
  } finally { button.disabled = false; }
};

// Check session and complete onboarding

// Restore user session and onboarding data
async function checkAuthSession() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error || !data.user) {
  console.log("No active session.");
  show("sInfo");
  return;
}

  const user = data.user;
  console.log("Login successful!");


// Check if the user already has a profile
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
  // Ignore pending onboarding for registered users
  localStorage.removeItem("filmBuddyPendingOnboarding");
  console.log("Existing user detected.");
}



      const pending = existingProfile
        ? null
        : localStorage.getItem("filmBuddyPendingOnboarding");

// Redirect new users to onboarding
if (!existingProfile && !pending) {
  console.log("New user detected.");

  S.p = null;
  S.rt = {};
  S.mode = "onb";
  S.pos = 0;

  show("sInfo");
  toast("Hoş geldin! Profilini oluştur ve 10 film puanla.");
  return;
}

  if (pending) {
    // Complete new user onboarding
    try {
      const saved = JSON.parse(pending);

      if (!saved.profile || !saved.ratings) {
        console.error("Incomplete onboarding data.");
        return;
      }

      const ratedCount = Object.values(saved.ratings)
        .filter(rating => Number(rating) >= 1 && Number(rating) <= 5)
        .length;

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
    // Load existing user profile
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

    // Load existing movie ratings
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

    // Convert database data to frontend format
    S.p = {
      ad: profile.first_name,
      soyad: profile.last_name,
      yas: profile.age,
      cins: profile.gender,
      sehir: profile.city
    };

    S.rt = Object.fromEntries(
      ratings.map(item => [item.movie_id, item.rating ?? 0])
    );

    console.log("Existing profile loaded!");
  }

  // Open matching screen
  S.mode = "more";
  S.tab = "adaylar";

  calc();
  show("sApp");
  changeMainPage("matches");

  console.log("Session restored successfully!");
}

checkAuthSession();
