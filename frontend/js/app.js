
const $ = id => document.getElementById(id);

// TEMSİLİ EŞLEŞME HESAPLAMASI

const hr = (a,b) => {
  const x = Math.sin(a*127.1+b*311.7)*43758.5453;
  return x-Math.floor(x);
};

const candRate = (c,f) => {
  if (hr(c,f)<.35) return 0;
  const q=1+hr(f,7)*4;
  return Math.max(1,Math.min(5,
    Math.round(q+(hr(c,f+50)-.5)*3)));
};

const S = {
  p:null,
  order:[],
  pos:0,
  rt:{},
  mode:"onb",
  page:"matches",
  tab:"adaylar",
  act:{},
  msgs:{},
  scores:{},
  chat:null
};

let onboardingInProgress=false;
let selectedRating=null;

const SECS=["sInfo","sVote","sLogin","sApp","sChat"];
const rated=()=>Object.values(S.rt).filter(v=>v>0).length;

function show(id) {
  SECS.forEach(s=>$(s).classList.toggle("hide",s!==id));
  window.scrollTo(0,0);
}

function toast(message) {
  const el=$("toast");
  el.textContent=message;
  el.style.opacity=1;
  setTimeout(()=>el.style.opacity=0,2200);
}

async function initializeMovies() {
  const success=await loadMovies();
  if (!success || !FILMS.length) {
    console.error("Movies could not be loaded.");
    return;
  }
  S.order=FILMS.map(f=>f.id);
  S.pos=0;
}


// ==========================================
// ONBOARDING
// ==========================================

function savePendingOnboarding() {
  if (!S.p || rated()<10) return;
  localStorage.setItem("filmBuddyPendingOnboarding",
    JSON.stringify({profile:S.p,ratings:S.rt}));
}

function prepareOnboardingData() {
  const saved=localStorage.getItem("filmBuddyPendingOnboarding");
  if (!saved) return null;

  const pending=JSON.parse(saved);
  const p=pending.profile;

  return {
    profile:{
      first_name:p.ad,
      last_name:p.soyad,
      age:p.yas,
      gender:p.cins,
      city:p.sehir
    },
    ratings:Object.entries(pending.ratings).map(([movieId,rating])=>({
      movie_id:Number(movieId),
      rating:rating===0?null:rating
    }))
  };
}

async function submitOnboarding() {
  const payload=prepareOnboardingData();
  if (!payload) return;

  const {data:sessionData,error:sessionError}=
    await supabaseClient.auth.getUser();

  if (sessionError || !sessionData.user) {
    console.error("User is not authenticated.");
    return;
  }

  const {data,error}=await supabaseClient.rpc(
    "save_onboarding",{
      p_profile:payload.profile,
      p_ratings:payload.ratings
    }
  );

  if (error) {
    console.error("Onboarding error:",error);
    return;
  }

  console.log("Onboarding saved:",data);
  localStorage.removeItem("filmBuddyPendingOnboarding");

  ["ad","soyad","yas","cins","sehir"].forEach(id=>$(id).value="");
}


// ==========================================
// TEMEL BİLGİLER
// ==========================================

$("go1").onclick=()=>{
  const p={
    ad:$("ad").value.trim(),
    soyad:$("soyad").value.trim(),
    yas:Number($("yas").value),
    cins:$("cins").value,
    sehir:$("sehir").value.trim()
  };

  if (!p.ad || !p.soyad || !p.yas || !p.cins || !p.sehir) {
    $("e1").textContent="Lütfen tüm alanları doldur.";
    return;
  }

  if (p.yas<18 || p.yas>99) {
    $("e1").textContent="Şimdilik 18 yaş ve üzeri kullanabilir.";
    return;
  }

  S.p=p;
  S.mode="onb";
  $("e1").textContent="";
  show("sVote");
  renderFilm();
};


// ==========================================
// FİLM OYLAMA
// ==========================================

function poster(f) {
  if (!f.poster_url)
    return '<div class="poster">Afiş bulunamadı</div>';

  const img=document.createElement("img");
  img.className="poster";
  img.src=f.poster_url;
  img.alt=f.t+" afişi";
  img.loading="lazy";
  return img.outerHTML;
}

function renderFilm() {
  const f=FILMS.find(movie=>movie.id===S.order[S.pos]);
  if (!f) {
    toast("Filmler henüz yüklenmedi.");
    return;
  }

  selectedRating=S.rt[f.id]??null;
  const value=S.rt[f.id];
  const n=rated();
  const onb=S.mode==="onb";

  $("cnt").textContent=onb
    ?`Eşleşmeye kalan: ${Math.max(0,10-n)}`
    :`Oylanan film: ${n}`;

  $("prog").style.width=onb
    ?Math.min(100,n*10)+"%"
    :"100%";

  $("exit").classList.toggle("hide",onb);
  $("updRow").classList.toggle("hide",onb);

  $("poster").innerHTML=poster(f);
  $("ft").textContent=f.t;
  $("fs").textContent=`${f.y} · ${f.g} · ${f.d} dk`;
  $("fd").textContent=
    "Yönetmen, oyuncular ve kısa özet burada yer alacak (temsili).";

  $("rate").innerHTML=[1,2,3,4,5].map(k=>
    `<button data-v="${k}" class="${value===k?"sel":""}">${k}</button>`
  ).join("");

  $("skip").classList.toggle("sel",value===0);
  $("prev").disabled=S.pos===0;
  $("next").disabled=false;
}

function vote(value) {
  if (onboardingInProgress) return;
  selectedRating=value;

  $("rate").querySelectorAll("button").forEach(button=>{
    button.classList.toggle("sel",
      Number(button.dataset.v)===value);
  });

  $("skip").classList.toggle("sel",value===0);
}

$("rate").onclick=e=>{
  const button=e.target.closest("button");
  if (button) vote(Number(button.dataset.v));
};

$("skip").onclick=()=>vote(0);

$("prev").onclick=()=>{
  if (onboardingInProgress) return;
  if (S.pos>0) {
    S.pos--;
    renderFilm();
  }
};

$("next").onclick=async()=>{
  if (onboardingInProgress) return;

  if (selectedRating===null) {
    toast("Önce bir puan seç veya İzlemedim'e bas.");
    return;
  }

  const movieId=S.order[S.pos];

  if (S.mode==="more") {
    onboardingInProgress=true;
    try {
      const saved=await saveMovieRating(movieId,selectedRating);
      if (!saved) {
        toast("Film puanı kaydedilemedi.");
        return;
      }
    } finally {
      onboardingInProgress=false;
    }
  }

  S.rt[movieId]=selectedRating;

  if (S.mode==="onb" && rated()>=10) {
    onboardingInProgress=true;
    savePendingOnboarding();

    try {
      const {data,error}=await supabaseClient.auth.getUser();

      if (error || !data?.user) {
        show("sLogin");
        return;
      }

      await submitOnboarding();

      if (localStorage.getItem("filmBuddyPendingOnboarding")) {
        toast("Profil kaydedilemedi.");
        return;
      }

      loadFavoritesForUser(data.user.id);
      loadDemoChats(data.user.id);
      S.mode="more";
      S.tab="adaylar";
      calc();
      show("sApp");
      changeMainPage("matches");

    } catch(error) {
      console.error("Onboarding failed:",error);
      toast("Kayıt sırasında hata oluştu.");
    } finally {
      onboardingInProgress=false;
    }
    return;
  }

  if (S.pos<S.order.length-1) {
    S.pos++;
    renderFilm();
  } else {
    toast("Tüm filmleri oyladın.");
  }
};

$("exit").onclick=()=>{
  show("sApp");
  changeMainPage(S.page);
};

$("upd").onclick=()=>{
  calc();
  show("sApp");
  changeMainPage("matches");
  toast("Eşleşmeler güncellendi.");
};


// ==========================================
// GOOGLE GİRİŞ
// ==========================================

async function startGoogleLogin(button) {
  button.disabled=true;

  try {
    const {error}=await supabaseClient.auth.signInWithOAuth({
      provider:"google",
      options:{redirectTo:window.location.origin}
    });

    if (error) {
      console.error("Google login error:",error);
      toast("Google ile giriş başlatılamadı.");
    }
  } catch(error) {
    console.error("Google login failed:",error);
    toast("Giriş sırasında bir hata oluştu.");
  } finally {
    button.disabled=false;
  }
}

$("googleLogin").onclick=async()=>{
  if (rated()<10) {
    toast("En az 10 filme puan vermelisin.");
    return;
  }
  await startGoogleLogin($("googleLogin"));
};

$("existingLogin").onclick=async()=>{
  localStorage.removeItem("filmBuddyPendingOnboarding");
  await startGoogleLogin($("existingLogin"));
};


// ==========================================
// EŞLEŞMELER
// ==========================================

function calc() {
  CANDS.forEach(c=>{
    let shared=0;
    let difference=0;

    Object.keys(S.rt).forEach(fid=>{
      const myRating=S.rt[fid];

      if (myRating>0) {
        const otherRating=candRate(c.id,Number(fid));

        if (otherRating>0) {
          shared++;
          difference+=Math.abs(myRating-otherRating);
        }
      }
    });

    S.scores[c.id]=shared
      ?Math.round(100*(1-difference/shared/4)*
         (.6+.4*Math.min(1,shared/6)))
      :0;

    c.shared=shared;
  });
}

function ring(score) {
  const r=26,c=2*Math.PI*r;

  return `<div class="ring">
    <svg width="62" height="62">
      <circle cx="31" cy="31" r="${r}" fill="none"
        stroke="var(--bd)" stroke-width="6"/>
      <circle cx="31" cy="31" r="${r}" fill="none"
        stroke="var(--hi)" stroke-width="6"
        stroke-linecap="round"
        stroke-dasharray="${c*score/100} ${c}"/>
    </svg>
    <span>%${score}</span>
  </div>`;
}

function lists() {
  const sorted=[...CANDS].sort(
    (a,b)=>S.scores[b.id]-S.scores[a.id]);

  return {
    adaylar:sorted.filter(c=>!S.act[c.id]),
    ilgi:sorted.filter(c=>c.likesYou&&!S.act[c.id]),
    esl:sorted.filter(c=>S.act[c.id]==="match")
  };
}

function card(c,kind,first) {
  const score=S.scores[c.id];
  let buttons="";

  if (kind==="esl") {
    buttons=`<div class="acts match-actions">
      <button data-a="profile" data-c="${c.id}">
        👤 Profili Gör
      </button>
      <button class="pri" data-a="chat" data-c="${c.id}">
        💬 Sohbete Git
      </button>
      <button class="match-danger" data-a="unmatch" data-c="${c.id}">
        × Eşleşmeyi Sil
      </button>
    </div>`;
  } else {
    buttons=`<div class="acts">
      <button data-a="pass" data-c="${c.id}">Geç</button>
      <button class="pri" data-a="like" data-c="${c.id}">
        ${kind==="ilgi"?"Kabul et":"İlgileniyorum"}
      </button>
    </div>
    ${kind==="adaylar"?`
      <button class="lnk" data-a="note" data-c="${c.id}">
        Not yazarak ilgi gönder
      </button>
      <div class="hide" id="nt${c.id}">
        <textarea rows="2" maxlength="200" id="ni${c.id}"
          placeholder="Kısa bir not yaz..."
          style="margin-top:8px"></textarea>
        <div class="row">
          <button class="pri" data-a="sendnote" data-c="${c.id}">
            Notla gönder
          </button>
        </div>
      </div>`:""}`;
  }

  return `<div class="card cand">
    ${first&&kind==="adaylar"&&score>0
      ?'<div class="best">★ Listenizdeki en yüksek uyum</div>'
      :""}
    <div class="hd">
      <div>
        <div class="nm">${c.n}</div>
        <div class="sub">${c.a} yaş · ${c.c}</div>
        ${kind==="ilgi"
          ?'<span class="chip">Size ilgi gönderdi</span>'
          :`<span class="sub" style="display:block;margin-top:8px">
             ${c.shared} ortak oylanan film</span>`}
      </div>
      ${ring(score)}
    </div>
    ${buttons}
  </div>`;
}

function renderApp() {
  const L=lists();

  $("hello").textContent=`Merhaba ${S.p?.ad||"filmsever"} 👋`;

  const tabs=[
    ["adaylar","Adaylar",L.adaylar.length],
    ["ilgi","Size ilgi",L.ilgi.length],
    ["esl","Eşleşmeler",L.esl.length]
  ];

  $("tabs").innerHTML=tabs.map(t=>
    `<button data-t="${t[0]}" class="${S.tab===t[0]?"on":""}">
      ${t[1]}<b>${t[2]||""}</b>
    </button>`).join("");

  const arr=L[S.tab];
  let heading="";

  if (S.tab==="adaylar") {
    heading=`<div class="top" style="margin-bottom:10px">
      <div>
        <h2>Bugün ${arr.length} aday</h2>
        <p>Birbirinize “İlgileniyorum” dediğinizde eşleşirsiniz.</p>
      </div>
    </div>
    <div class="box" style="margin-bottom:14px">
      <span>Daha iyi eşleşme için daha fazla film oyla,
      sonra eşleşmeleri güncelle.</span>
    </div>`;
  } else if (S.tab==="ilgi") {
    heading="<h2>Size ilgi gösterenler</h2>";
  } else {
    heading="<h2>Eşleşmelerin</h2>";
  }

  const empty=S.tab==="esl"
    ?"Henüz eşleşme yok. İki taraf da ilgilendiğinde sohbet açılır."
    :"Şimdilik kimse yok. Daha fazla film oyla.";

  $("list").innerHTML=heading+(
    arr.length
      ?`<div class="cards">
        ${arr.map((c,i)=>card(c,S.tab,i===0)).join("")}
      </div>`
      :`<div class="empty">${empty}</div>`
  );
}

$("tabs").onclick=e=>{
  const button=e.target.closest("button");
  if (button) {
    S.tab=button.dataset.t;
    renderApp();
  }
};

$("more").onclick=continueVoting;

$("logout").onclick=async()=>{
  const button=$("logout");
  button.disabled=true;

  try {
    const {error}=await supabaseClient.auth.signOut();

    if (error) {
      toast("Çıkış yapılamadı.");
      return;
    }

    S.p={};
    S.rt={};
    S.act={};
    S.msgs={};
    S.scores={};
    S.chat=null;
    chatStorageUser=null;
    S.pos=0;
    S.mode="onb";
    S.tab="adaylar";
    S.page="matches";

    favoriteIds=[];
    favoriteUserId=null;
    profileEditing=false;

    localStorage.removeItem("filmBuddyPendingOnboarding");
    show("sInfo");

  } catch(error) {
    console.error("Logout failed:",error);
    toast("Çıkış sırasında hata oluştu.");
  } finally {
    button.disabled=false;
  }
};

$("list").onclick=e=>{
  const button=e.target.closest("button");
  if (!button) return;

  const id=Number(button.dataset.c);
  const action=button.dataset.a;
  const candidate=candidateById(id);

  if (!candidate) return;

  if (action==="pass") {
    S.act[id]="pass";

  } else if (action==="like"||action==="sendnote") {
    if (candidate.likesYou) {
      S.act[id]="match";
      toast(`${candidate.n} ile eşleştiniz! 🎉`);
    } else {
      S.act[id]="sent";
      toast("İlgin gönderildi");
    }

  } else if (action==="note") {
    $("nt"+id).classList.toggle("hide");
    return;

  } else if (action==="chat") {
    openChat(id);
    return;

  } else if (action==="profile") {
    openMatchProfile(id);
    return;

  } else if (action==="unmatch") {
    openUnmatchModal(id);
    return;
  }

  saveDemoChats();
  renderApp();
};


// ==========================================
// SOHBET - FRONTEND DEMOSU
// ==========================================

const CHAT_LIMIT = 20;

let chatStorageUser = null;
let selectedProfileId = null;
let unmatchTargetId = null;
let chatFocusBeforeModal = null;

function candidateById(id) {
  return CANDS.find(c => Number(c.id) === Number(id));
}

function chatStorageKey() {
  return chatStorageUser
    ? `filmMatchDemoChats:${chatStorageUser}`
    : null;
}

function saveDemoChats() {
  const key=chatStorageKey();
  if (!key) return;

  try {
    localStorage.setItem(key,JSON.stringify({
      msgs:S.msgs,
      acts:S.act
    }));
  } catch(error) {
    console.warn("Demo sohbet kaydedilemedi:",error);
  }
}

function loadDemoChats(userId) {
  chatStorageUser=userId;
  S.msgs={};
  S.act={};

  try {
    const saved=localStorage.getItem(chatStorageKey());
    const data=JSON.parse(saved||"{}");

    if (data.msgs && typeof data.msgs==="object")
      S.msgs=data.msgs;

    if (data.acts && typeof data.acts==="object")
      S.act=data.acts;

  } catch(error) {
    console.warn("Demo sohbet yüklenemedi:",error);
  }
}

function matchedCandidates() {
  return CANDS.filter(c => S.act[c.id]==="match");
}

function initials(name) {
  return String(name||"FM")
    .trim()
    .split(/\s+/)
    .slice(0,2)
    .map(word=>word[0]||"")
    .join("")
    .toLocaleUpperCase("tr");
}

function chatMessages(id) {
  if (!Array.isArray(S.msgs[id])) {
    S.msgs[id]=[];
  }
  return S.msgs[id];
}

function messageTime(value) {
  if (!value) return "";

  const date=new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("tr-TR",{
    day:"2-digit",
    month:"short",
    hour:"2-digit",
    minute:"2-digit"
  });
}

function renderChatContacts() {
  const list=$("chatContacts");
  list.replaceChildren();

  const candidates=matchedCandidates();

  if (!candidates.length) {
    const empty=document.createElement("div");
    empty.className="empty";
    empty.textContent="Henüz eşleştiğin kimse yok.";
    list.append(empty);
    return;
  }

  candidates.sort((a,b)=>{
    const lastA=chatMessages(a.id).at(-1)?.at||"";
    const lastB=chatMessages(b.id).at(-1)?.at||"";
    return lastB.localeCompare(lastA);
  });

  candidates.forEach(c=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="chat-contact";

    if (Number(S.chat)===Number(c.id)) {
      button.classList.add("active");
    }

    const avatar=document.createElement("span");
    avatar.className="chat-avatar";
    avatar.textContent=initials(c.n);

    const details=document.createElement("span");
    details.className="chat-contact-details";

    const name=document.createElement("strong");
    name.textContent=c.n;

    const preview=document.createElement("small");
    const last=chatMessages(c.id).at(-1);

    preview.textContent=last
      ?(last.me?"Sen: ":"")+last.t
      :"Henüz mesaj yok";

    details.append(name,preview);

    const date=document.createElement("small");
    date.className="chat-contact-date";
    date.textContent=last?messageTime(last.at):"";

    button.append(avatar,details,date);

    button.onclick=()=>selectConversation(c.id);
    list.append(button);
  });
}

function selectConversation(id) {
  if (!matchedCandidates().some(c=>Number(c.id)===Number(id))) {
    return;
  }

  S.chat=Number(id);
  $("chatLayout").classList.add("chat-mobile-open");

  renderChatContacts();
  drawChat();
}

function openChat(id) {
  if (!matchedCandidates().some(c=>Number(c.id)===Number(id))) {
    toast("Sohbet için karşılıklı eşleşmeniz gerekiyor.");
    return;
  }

  S.chat=Number(id);
  show("sChat");

  renderChatContacts();
  drawChat();

  $("chatLayout").classList.add("chat-mobile-open");
}

function drawChat() {
  const c=candidateById(S.chat);
  const valid=c&&S.act[c.id]==="match";

  $("chatPanel").classList.toggle("hide",!valid);

  if (!valid) return;

  $("chatTitle").textContent=c.n;
  $("chatSubtitle").textContent=
    `%${S.scores[c.id]??0} film uyumu`;

  $("chatAvatar").textContent=initials(c.n);

  const box=$("chatBox");
  box.replaceChildren();

  const messages=chatMessages(c.id);

  if (!messages.length) {
    const empty=document.createElement("div");
    empty.className="empty";
    empty.textContent=
      "Henüz konuşma yok. İlk mesajı sen gönder!";
    box.append(empty);
  }

  messages.forEach(m=>{
    const entry=document.createElement("div");
    entry.className="chat-entry"+(m.me?" mine":"");

    const bubble=document.createElement("div");
    bubble.className="chat-bubble";
    bubble.textContent=m.t;

    const date=document.createElement("span");
    date.className="chat-message-date";
    date.textContent=messageTime(m.at);

    entry.append(bubble,date);
    box.append(entry);
  });

  const sent=messages.filter(m=>m.me).length;
  const remaining=Math.max(0,CHAT_LIMIT-sent);

  $("chatQuota").textContent=
    `${remaining} / ${CHAT_LIMIT}`;

  $("chatQuotaFill").style.width=
    `${remaining/CHAT_LIMIT*100}%`;

  $("chatIn").disabled=remaining===0;
  $("chatSend").disabled=remaining===0;

  $("chatIn").placeholder=remaining
    ?"Mesaj yaz..."
    :"Mesaj hakkın doldu";

  box.scrollTop=box.scrollHeight;
}

function send() {
  const text=$("chatIn").value.trim();
  const c=candidateById(S.chat);

  if (!c || S.act[c.id]!=="match" || !text) return;

  const messages=chatMessages(c.id);

  if (messages.filter(m=>m.me).length>=CHAT_LIMIT) {
    toast("Bu eşleşmede mesaj hakkın doldu.");
    return;
  }

  messages.push({
    me:1,
    t:text,
    at:new Date().toISOString()
  });

  $("chatIn").value="";

  saveDemoChats();
  renderChatContacts();
  drawChat();
}

$("chatSend").onclick=send;

$("chatIn").onkeydown=e=>{
  if (e.key==="Enter") {
    e.preventDefault();
    send();
  }
};

$("chatBack").onclick=()=>{
  S.tab="esl";

  $("chatLayout").classList.remove("chat-mobile-open");

  show("sApp");
  changeMainPage("matches");
};

$("chatMobileBack").onclick=()=>{
  $("chatLayout").classList.remove("chat-mobile-open");
};

$("chatProfile").onclick=()=>{
  openMatchProfile(S.chat);
};


// ==========================================
// KARŞI TARAFIN PROFİLİ
// ==========================================

function closeMatchProfile() {
  $("matchProfileModal").classList.add("hide");
  document.body.classList.remove("rating-modal-open");

  selectedProfileId=null;

  if (chatFocusBeforeModal?.isConnected) {
    chatFocusBeforeModal.focus();
  }
}

function openMatchProfile(id) {
  const c=candidateById(id);

  if (!c || S.act[c.id]!=="match") return;

  selectedProfileId=Number(id);
  chatFocusBeforeModal=document.activeElement;

  const body=$("matchProfileBody");
  body.replaceChildren();

  const person=document.createElement("div");
  person.className="match-person-line";

  const avatar=document.createElement("div");
  avatar.className="chat-avatar";
  avatar.textContent=initials(c.n);

  const details=document.createElement("div");

  const name=document.createElement("strong");
  name.textContent=c.n;

  const about=document.createElement("p");
  about.textContent=`${c.a} yaş · ${c.c}`;

  details.append(name,about);
  person.append(avatar,details);

  const score=document.createElement("div");
  score.className="match-profile-score";
  score.textContent=
    `Film uyumu: %${S.scores[c.id]??0} (temsili)`;

  const favorites=document.createElement("div");
  favorites.className="match-profile-placeholder";
  favorites.innerHTML=`
    <strong>❤️ Favori 4 film</strong>
    <p>Gerçek kullanıcı favorileri Supabase bağlantısı
    sonrası burada gösterilecek.</p>
  `;

  const common=document.createElement("div");
  common.className="match-profile-placeholder";
  common.innerHTML=`
    <strong>⭐ Ortak sevilen filmler</strong>
    <p>Gerçek kullanıcı film puanları bağlandığında
    hesaplanacak.</p>
  `;

  body.append(person,score,favorites,common);

  $("matchProfileModal").classList.remove("hide");
  document.body.classList.add("rating-modal-open");

  $("matchProfileClose").focus();
}

$("matchProfileClose").onclick=closeMatchProfile;
$("matchProfileBackdrop").onclick=closeMatchProfile;

$("matchProfileChat").onclick=()=>{
  const id=selectedProfileId;
  closeMatchProfile();

  if (id!==null) openChat(id);
};


// ==========================================
// EŞLEŞMEYİ SİL
// ==========================================

function closeUnmatchModal() {
  $("unmatchModal").classList.add("hide");
  document.body.classList.remove("rating-modal-open");

  unmatchTargetId=null;

  if (chatFocusBeforeModal?.isConnected) {
    chatFocusBeforeModal.focus();
  }
}

function openUnmatchModal(id) {
  const c=candidateById(id);

  if (!c || S.act[c.id]!=="match") return;

  unmatchTargetId=Number(id);
  chatFocusBeforeModal=document.activeElement;

  $("unmatchMessage").textContent=
    `${c.n} ile eşleşmeni kaldırmak istiyor musun? `+
    "Bu demo işleminde konuşma listenden kaldırılacak.";

  $("unmatchModal").classList.remove("hide");
  document.body.classList.add("rating-modal-open");

  $("unmatchCancel").focus();
}

$("unmatchCancel").onclick=closeUnmatchModal;
$("unmatchBackdrop").onclick=closeUnmatchModal;

$("unmatchConfirm").onclick=()=>{
  if (unmatchTargetId===null) return;

  const id=unmatchTargetId;

  S.act[id]="unmatched";

  if (Number(S.chat)===id) {
    S.chat=matchedCandidates()[0]?.id??null;
  }

  saveDemoChats();
  closeUnmatchModal();

  renderApp();
  renderChatContacts();
  drawChat();

  toast("Eşleşme kaldırıldı (demo).");
};

document.addEventListener("keydown",e=>{
  if (e.key!=="Escape") return;

  if (!$("matchProfileModal").classList.contains("hide")) {
    closeMatchProfile();
  }

  if (!$("unmatchModal").classList.contains("hide")) {
    closeUnmatchModal();
  }
});


// ==========================================
// ANA MENÜ
// ==========================================

function changeMainPage(page) {
  S.page=page;

  ["matches","votes","profile"].forEach(name=>{
    const cap=name[0].toUpperCase()+name.slice(1);

    $("page"+cap).classList.toggle("hide",page!==name);
    $("menu"+cap).classList.toggle("active",page===name);
  });

  if (page==="matches") renderApp();
  if (page==="votes") renderVoteHistory();
  if (page==="profile") renderProfile();
}

$("menuMatches").onclick=()=>changeMainPage("matches");
$("menuVotes").onclick=()=>changeMainPage("votes");
$("menuProfile").onclick=()=>changeMainPage("profile");

function continueVoting() {
  S.mode="more";

  const next=S.order.findIndex(id=>S.rt[id]===undefined);
  S.pos=next<0?0:next;

  show("sVote");
  renderFilm();
}

$("voteMore").onclick=continueVoting;


// ==========================================
// OYLAMALARIM
// ==========================================

function renderVoteHistory() {
  const container=$("voteHistory");
  container.replaceChildren();

  const filter=$("voteFilter").value;
  const sort=$("voteSort").value;

  const ratedMovies=FILMS.filter(f=>
    Number(S.rt[f.id])>=1&&Number(S.rt[f.id])<=5);

  $("voteSummary").textContent=
    `${ratedMovies.length} puanladığım film`;

  let movies=ratedMovies.filter(f=>
    filter==="all"||Number(S.rt[f.id])===Number(filter));

  if (sort==="high")
    movies.sort((a,b)=>Number(S.rt[b.id])-Number(S.rt[a.id]));

  if (sort==="low")
    movies.sort((a,b)=>Number(S.rt[a.id])-Number(S.rt[b.id]));

  if (sort==="az")
    movies.sort((a,b)=>a.t.localeCompare(b.t,"tr"));

  if (sort==="za")
    movies.sort((a,b)=>b.t.localeCompare(a.t,"tr"));

  if (!movies.length) {
    container.innerHTML=
      '<div class="empty">Bu filtreye uyan puanlanmış film yok.</div>';
    return;
  }

  const grid=document.createElement("div");
  grid.className="vote-grid";

  movies.forEach(f=>{
    const value=Number(S.rt[f.id]);
    const tile=document.createElement("article");
    tile.className="vote-tile";

    const image=document.createElement("div");
    image.className="vote-tile-poster";

    if (f.poster_url) {
      const img=document.createElement("img");
      img.src=f.poster_url;
      img.alt=f.t+" afişi";
      img.loading="lazy";
      image.append(img);
    } else {
      image.textContent="Afiş bulunamadı";
    }

    const info=document.createElement("div");
    info.className="vote-tile-info";

    const title=document.createElement("h3");
    title.textContent=f.t;

    const year=document.createElement("p");
    year.textContent=f.y||"";

    const stars=document.createElement("div");
    stars.className="vote-stars";
    stars.textContent="★".repeat(value)+"☆".repeat(5-value);

    const edit=document.createElement("button");
    edit.type="button";
    edit.className="vote-edit";
    edit.textContent="✏️ Puanı düzenle";

    edit.onclick=()=>openRatingModal(f.id);

    info.append(title,year,stars,edit);
    tile.append(image,info);
    grid.append(tile);
  });

  container.append(grid);
}

$("voteFilter").onchange=renderVoteHistory;
$("voteSort").onchange=renderVoteHistory;


// ==========================================
// PUAN DÜZENLEME
// ==========================================

let editingMovieId=null;
let editingRating=null;
let ratingSaving=false;
let ratingPreviousFocus=null;

function selectModalRating(value) {
  if (ratingSaving) return;

  editingRating=value;

  $("ratingChoices").querySelectorAll("button").forEach(button=>{
    const selected=Number(button.dataset.rating)===value;
    button.classList.toggle("sel",selected);
    button.setAttribute("aria-pressed",String(selected));
  });

  $("ratingNotWatched").classList.toggle("sel",value===0);
  $("ratingError").textContent="";
}

function openRatingModal(movieId) {
  const movie=FILMS.find(f=>String(f.id)===String(movieId));
  if (!movie) return;

  editingMovieId=movie.id;
  ratingPreviousFocus=document.activeElement;

  $("ratingModalTitle").textContent=movie.t;

  $("ratingModalMeta").textContent=[
    movie.y,
    movie.g,
    movie.d?movie.d+" dk":""
  ].filter(Boolean).join(" · ");

  $("ratingCurrent").textContent=
    `Mevcut puanın: ${S.rt[movie.id]}/5`;

  const posterContainer=$("ratingPoster");
  posterContainer.replaceChildren();

  if (movie.poster_url) {
    const img=document.createElement("img");
    img.src=movie.poster_url;
    img.alt=movie.t+" afişi";
    posterContainer.append(img);
  } else {
    posterContainer.textContent="Afiş bulunamadı";
  }

  $("ratingChoices").replaceChildren();

  for (let value=1;value<=5;value++) {
    const button=document.createElement("button");
    button.type="button";
    button.dataset.rating=String(value);
    button.textContent=String(value);
    button.onclick=()=>selectModalRating(value);
    $("ratingChoices").append(button);
  }

  $("ratingError").textContent="";
  $("ratingModal").classList.remove("hide");
  document.body.classList.add("rating-modal-open");

  selectModalRating(Number(S.rt[movie.id]));
  $("ratingClose").focus();
}

function closeRatingModal() {
  if (ratingSaving) return;

  $("ratingModal").classList.add("hide");
  document.body.classList.remove("rating-modal-open");

  editingMovieId=null;
  editingRating=null;

  if (ratingPreviousFocus?.isConnected)
    ratingPreviousFocus.focus();
}

$("ratingNotWatched").onclick=()=>selectModalRating(0);
$("ratingClose").onclick=closeRatingModal;
$("ratingCancel").onclick=closeRatingModal;
$("ratingBackdrop").onclick=closeRatingModal;

$("ratingModal").addEventListener("keydown",e=>{
  if (e.key==="Escape") closeRatingModal();
});

$("ratingSave").onclick=async()=>{
  if (ratingSaving||editingMovieId===null) return;

  if (editingRating===null) {
    $("ratingError").textContent="Lütfen bir puan seç.";
    return;
  }

  ratingSaving=true;

  const button=$("ratingSave");
  button.disabled=true;
  button.textContent="Kaydediliyor...";

  try {
    const saved=await saveMovieRating(
      editingMovieId,editingRating
    );

    if (!saved) {
      $("ratingError").textContent="Puan kaydedilemedi.";
      return;
    }

    S.rt[editingMovieId]=editingRating;
    ratingSaving=false;

    closeRatingModal();
    renderVoteHistory();

    const valid=validFavorites();

    if (valid.length!==favoriteIds.length) {
      favoriteIds=valid;
      storeFavorites();
    }

    toast("Film puanın güncellendi.");

  } catch(error) {
    console.error("Rating update failed:",error);
    $("ratingError").textContent="Puan güncellenemedi.";

  } finally {
    ratingSaving=false;
    button.disabled=false;
    button.textContent="Puanı Güncelle";
  }
};


// ==========================================
// SUPABASE PUAN KAYDI
// ==========================================

async function saveMovieRating(movieId,rating) {
  try {
    const {data,error:authError}=
      await supabaseClient.auth.getUser();

    if (authError||!data?.user) return false;

    const {error}=await supabaseClient
      .from("user_movies")
      .upsert({
        user_id:data.user.id,
        movie_id:movieId,
        rating:rating===0?null:rating
      },{onConflict:"user_id,movie_id"});

    if (error) {
      console.error("Rating save error:",error);
      return false;
    }

    return true;

  } catch(error) {
    console.error("Rating save failed:",error);
    return false;
  }
}


// ==========================================
// PROFİL VE FAVORİLER
// ==========================================

let profileEditing=false;
let favoriteIds=[];
let favoriteUserId=null;

function favoriteStorageKey() {
  return favoriteUserId
    ?`filmMatchFavorites:${favoriteUserId}`
    :null;
}

function loadFavoritesForUser(userId) {
  favoriteUserId=userId;

  try {
    const stored=JSON.parse(
      localStorage.getItem(favoriteStorageKey())||"[]"
    );

    favoriteIds=Array.isArray(stored)
      ?stored.slice(0,4).map(String)
      :[];

  } catch(error) {
    favoriteIds=[];
  }

  favoriteIds=[...new Set(favoriteIds)];
}

function storeFavorites() {
  const key=favoriteStorageKey();

  if (key) {
    localStorage.setItem(key,JSON.stringify(favoriteIds));
  }
}

function validFavorites() {
  return favoriteIds.filter(id=>
    FILMS.some(f=>
      String(f.id)===id &&
      Number(S.rt[f.id])>=1 &&
      Number(S.rt[f.id])<=5
    )
  );
}

function moviePosterElement(f) {
  const wrapper=document.createElement("div");
  wrapper.className="favorite-poster";

  if (f.poster_url) {
    const img=document.createElement("img");
    img.src=f.poster_url;
    img.alt=f.t+" afişi";
    img.loading="lazy";
    wrapper.append(img);
  } else {
    wrapper.textContent="Afiş bulunamadı";
  }

  return wrapper;
}

function renderFavoriteGrid() {
  const grid=$("favoriteGrid");
  grid.replaceChildren();

  const valid=validFavorites();

  $("favoriteCount").textContent=`${valid.length} / 4 seçildi`;

  for (let i=0;i<4;i++) {
    const slot=document.createElement("div");
    slot.className="favorite-slot";

    const id=valid[i];

    if (id!==undefined) {
      const movie=FILMS.find(f=>String(f.id)===id);

      slot.append(moviePosterElement(movie));

      const name=document.createElement("div");
      name.className="favorite-name";
      name.textContent=movie.t;

      const remove=document.createElement("button");
      remove.type="button";
      remove.className="favorite-remove";
      remove.textContent="×";

      remove.setAttribute(
        "aria-label",
        movie.t+" favorilerden çıkar"
      );

      remove.onclick=()=>{
        favoriteIds=favoriteIds.filter(item=>item!==id);
        storeFavorites();
        renderFavoriteGrid();
      };

      slot.append(remove,name);

    } else {
      const add=document.createElement("button");
      add.type="button";
      add.className="favorite-add";

      add.innerHTML="<strong>+</strong><span>Film ekle</span>";
      add.onclick=openFavoritePicker;

      slot.append(add);
    }

    grid.append(slot);
  }
}

function renderProfileStats() {
  const values=Object.values(S.rt)
    .map(Number)
    .filter(v=>v>=1&&v<=5);

  const average=values.length
    ?values.reduce((a,b)=>a+b,0)/values.length
    :null;

  $("profileAverage").textContent=
    average===null?"—":average.toFixed(1);

  const counts=[5,4,3,2,1].map(r=>
    values.filter(v=>v===r).length
  );

  const max=Math.max(1,...counts);
  const chart=$("profileChart");

  chart.replaceChildren();

  counts.forEach((count,i)=>{
    const row=document.createElement("div");
    row.className="profile-chart-row";

    const label=document.createElement("span");
    label.textContent=`${5-i} ★`;

    const track=document.createElement("div");
    track.className="profile-chart-track";

    const bar=document.createElement("div");
    bar.className="profile-chart-fill";
    bar.style.width=`${count/max*100}%`;

    const total=document.createElement("span");
    total.textContent=count;

    track.append(bar);
    row.append(label,track,total);
    chart.append(row);
  });
}

function setProfileEditing(enabled) {
  profileEditing=enabled;

  [
    "profileName",
    "profileSurname",
    "profileAge",
    "profileGender",
    "profileCity"
  ].forEach(id=>{
    $(id).disabled=!enabled;
  });

  $("profileEditActions").classList.toggle("hide",!enabled);
  $("editProfile").classList.toggle("hide",enabled);
}

function renderProfile() {
  if (!S.p) return;

  $("profileName").value=S.p.ad||"";
  $("profileSurname").value=S.p.soyad||"";
  $("profileAge").value=S.p.yas||"";
  $("profileGender").value=
    S.p.cins||"Belirtmek istemiyorum";
  $("profileCity").value=S.p.sehir||"";

  $("profileError").textContent="";

  setProfileEditing(false);
  renderProfileStats();
  renderFavoriteGrid();
}

$("editProfile").onclick=()=>setProfileEditing(true);
$("cancelProfile").onclick=renderProfile;


// ==========================================
// FAVORİ SEÇME PENCERESİ
// ==========================================

let favoritePickerFocus=null;

function renderFavoritePicker() {
  const picker=$("favoritePicker");
  picker.replaceChildren();

  const searchText=$("favoriteSearch").value
    .trim()
    .toLocaleLowerCase("tr");

  const selected=validFavorites();

  const options=FILMS.filter(f=>
    Number(S.rt[f.id])>=1 &&
    Number(S.rt[f.id])<=5 &&
    !selected.includes(String(f.id)) &&
    f.t.toLocaleLowerCase("tr").includes(searchText)
  );

  if (!options.length) {
    const empty=document.createElement("div");
    empty.className="empty";

    empty.textContent=searchText
      ?"Aradığın film puanladığın filmler arasında bulunamadı."
      :"Eklenebilecek başka puanlanmış film yok.";

    picker.append(empty);
    return;
  }

  options.forEach(f=>{
    const button=document.createElement("button");
    button.type="button";
    button.className="favorite-picker-tile";

    const label=document.createElement("span");
    label.textContent=f.t;

    button.append(moviePosterElement(f),label);

    button.onclick=()=>{
      if (validFavorites().length>=4) return;

      favoriteIds.push(String(f.id));
      favoriteIds=[...new Set(favoriteIds)];

      storeFavorites();
      closeFavoritePicker();
      renderFavoriteGrid();
    };

    picker.append(button);
  });
}

function openFavoritePicker() {
  if (validFavorites().length>=4) return;

  favoritePickerFocus=document.activeElement;

  $("favoriteSearch").value="";
  $("favoriteModal").classList.remove("hide");
  document.body.classList.add("rating-modal-open");

  renderFavoritePicker();
  $("favoriteSearch").focus();
}

function closeFavoritePicker() {
  $("favoriteModal").classList.add("hide");
  document.body.classList.remove("rating-modal-open");

  if (favoritePickerFocus?.isConnected) {
    favoritePickerFocus.focus();
  }
}

$("favoriteSearch").oninput=renderFavoritePicker;
$("favoriteClose").onclick=closeFavoritePicker;
$("favoriteCancel").onclick=closeFavoritePicker;
$("favoriteBackdrop").onclick=closeFavoritePicker;

$("favoriteModal").addEventListener("keydown",e=>{
  if (e.key==="Escape") closeFavoritePicker();
});


// ==========================================
// PROFİL BİLGİSİ KAYDETME
// ==========================================

$("saveProfile").onclick=async()=>{
  const updated={
    ad:$("profileName").value.trim(),
    soyad:$("profileSurname").value.trim(),
    yas:Number($("profileAge").value),
    cins:$("profileGender").value,
    sehir:$("profileCity").value.trim()
  };

  if (
    !updated.ad ||
    !updated.soyad ||
    !updated.sehir ||
    !updated.cins ||
    !Number.isInteger(updated.yas) ||
    updated.yas<18 ||
    updated.yas>99
  ) {
    $("profileError").textContent=
      "Lütfen geçerli bilgileri gir.";
    return;
  }

  const button=$("saveProfile");
  button.disabled=true;
  $("profileError").textContent="";

  try {
    const {data,error:authError}=
      await supabaseClient.auth.getUser();

    if (authError||!data?.user) {
      throw new Error("Oturum bulunamadı.");
    }

    const {error}=await supabaseClient
      .from("profiles")
      .update({
        first_name:updated.ad,
        last_name:updated.soyad,
        age:updated.yas,
        gender:updated.cins,
        city:updated.sehir
      })
      .eq("id",data.user.id);

    if (error) throw error;

    S.p=updated;

    $("hello").textContent=`Merhaba ${S.p.ad} 👋`;
    setProfileEditing(false);
    toast("Profil bilgilerin kaydedildi.");

  } catch(error) {
    console.error("Profile update failed:",error);

    $("profileError").textContent=
      "Profil kaydedilemedi. Supabase izinlerini kontrol edin.";

  } finally {
    button.disabled=false;
  }
};


// ==========================================
// OTURUM KONTROLÜ
// ==========================================

async function checkAuthSession() {
  const {data,error}=await supabaseClient.auth.getUser();

  if (error||!data?.user) {
    console.log("No active session.");
    show("sInfo");
    return;
  }

  const user=data.user;

  const {data:existingProfile,error:existingError}=
    await supabaseClient
      .from("profiles")
      .select("id")
      .eq("id",user.id)
      .maybeSingle();

  if (existingError) {
    console.error("Profile check failed:",existingError);
    return;
  }

  if (existingProfile) {
    localStorage.removeItem("filmBuddyPendingOnboarding");
  }

  const pending=existingProfile
    ?null
    :localStorage.getItem("filmBuddyPendingOnboarding");

  if (!existingProfile&&!pending) {
    S.p=null;
    S.rt={};
    S.mode="onb";
    S.pos=0;

    show("sInfo");

    toast("Hoş geldin! Profilini oluştur ve 10 film puanla.");
    return;
  }

  if (pending) {
    try {
      const saved=JSON.parse(pending);

      if (!saved.profile||!saved.ratings) return;

      const ratedCount=Object.values(saved.ratings)
        .filter(r=>Number(r)>=1&&Number(r)<=5).length;

      if (ratedCount<10) return;

      S.p=saved.profile;
      S.rt=saved.ratings;

      await submitOnboarding();

      if (localStorage.getItem("filmBuddyPendingOnboarding")) {
        return;
      }

    } catch(error) {
      console.error("Onboarding error:",error);
      return;
    }

  } else {
    const {data:profile,error:profileError}=
      await supabaseClient
        .from("profiles")
        .select("first_name,last_name,age,gender,city")
        .eq("id",user.id)
        .maybeSingle();

    if (profileError||!profile) {
      console.error("Profile not found:",profileError);
      return;
    }

    const {data:ratings,error:ratingsError}=
      await supabaseClient
        .from("user_movies")
        .select("movie_id,rating")
        .eq("user_id",user.id);

    if (ratingsError) {
      console.error("Ratings error:",ratingsError);
      return;
    }

    const ratedCount=ratings.filter(
      item=>item.rating>=1&&item.rating<=5
    ).length;

    if (ratedCount<10) {
      console.error("User has fewer than 10 rated movies.");
      return;
    }

    S.p={
      ad:profile.first_name,
      soyad:profile.last_name,
      yas:profile.age,
      cins:profile.gender,
      sehir:profile.city
    };

    S.rt=Object.fromEntries(
      ratings.map(item=>[
        item.movie_id,
        item.rating??0
      ])
    );
  }

  loadFavoritesForUser(user.id);
  loadDemoChats(user.id);

  S.mode="more";
  S.tab="adaylar";

  calc();

  show("sApp");
  changeMainPage("matches");
}


// ==========================================
// UYGULAMAYI BAŞLAT
// ==========================================

async function startApp() {
  try {
    await initializeMovies();
    await checkAuthSession();

  } catch(error) {
    console.error("App initialization failed:",error);
    toast("Uygulama başlatılamadı.");
    show("sInfo");
  }
}

startApp();
