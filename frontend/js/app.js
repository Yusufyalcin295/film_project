// ---- Temsili veri (sonra Supabase'deki movies / profiles tablolarından gelecek) ----
const $=id=>document.getElementById(id);
const hr=(a,b)=>{const x=Math.sin(a*127.1+b*311.7)*43758.5453;return x-Math.floor(x)};
const candRate=(c,f)=>{if(hr(c,f)<.35)return 0;const q=1+hr(f,7)*4;return Math.max(1,Math.min(5,Math.round(q+(hr(c,f+50)-.5)*3)))};
const S={p:null,order:[],pos:0,rt:{},mode:"onb",tab:"adaylar",act:{},msgs:{},scores:{},chat:null};
S.order=FILMS.map(f=>f.id).sort(()=>Math.random()-.5);

const SECS=["sInfo","sVote","sLogin","sApp","sChat"];
const show=id=>{SECS.forEach(s=>$(s).classList.toggle("hide",s!==id));window.scrollTo(0,0)};
function toast(t){const e=$("toast");e.textContent=t;e.style.opacity=1;setTimeout(()=>e.style.opacity=0,2200)}
const rated=()=>Object.values(S.rt).filter(v=>v>0).length;

// ---- 1. Temel bilgiler ----
$("go1").onclick=()=>{
  const p={ad:$("ad").value.trim(),soyad:$("soyad").value.trim(),yas:+$("yas").value,cins:$("cins").value,sehir:$("sehir").value.trim()};
  if(!p.ad||!p.soyad||!p.yas||!p.cins||!p.sehir){$("e1").textContent="Lütfen tüm alanları doldur.";return}
  if(p.yas<18||p.yas>99){$("e1").textContent="Şimdilik 18 yaş ve üzeri kullanabilir.";return}
  S.p=p;$("e1").textContent="";S.mode="onb";show("sVote");renderFilm();
};

// ---- 2. Film oylama ----
function poster(f){const h=(f.id*47)%360;return `<svg class="poster" viewBox="0 0 200 300" role="img" aria-label="${f.t} afişi (temsili)"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h} 60% 38%)"/><stop offset="1" stop-color="hsl(${(h+50)%360} 65% 16%)"/></linearGradient></defs><rect width="200" height="300" fill="url(#g)"/><circle cx="150" cy="70" r="46" fill="hsl(${h} 80% 70%)" opacity=".25"/><text x="100" y="160" text-anchor="middle" fill="#fff" font-size="20" font-weight="700">${f.t}</text><text x="100" y="282" text-anchor="middle" fill="#fff" opacity=".6" font-size="10">TEMSİLİ AFİŞ</text></svg>`}
function renderFilm(){
  const f=FILMS[S.order[S.pos]],v=S.rt[f.id],n=rated(),onb=S.mode==="onb";
  $("cnt").textContent=onb?`Eşleşmeye kalan: ${Math.max(0,10-n)}`:`Oylanan film: ${n}`;
  $("prog").style.width=onb?Math.min(100,n*10)+"%":"100%";
  $("exit").classList.toggle("hide",onb);$("updRow").classList.toggle("hide",onb);
  $("poster").innerHTML=poster(f);$("ft").textContent=f.t;
  $("fs").textContent=`${f.y} · ${f.g} · ${f.d} dk`;
  $("fd").textContent="Yönetmen, oyuncular ve kısa özet burada yer alacak (temsili).";
  $("rate").innerHTML=[1,2,3,4,5].map(k=>`<button data-v="${k}" class="${v===k?"sel":""}">${k}</button>`).join("");
  $("skip").classList.toggle("sel",v===0);
  $("prev").disabled=S.pos===0;$("next").disabled=S.pos>=S.order.length-1;
}
function vote(v){
  S.rt[S.order[S.pos]]=v;
  if(S.mode==="onb"&&rated()>=10){show("sLogin");return}
  if(S.pos<S.order.length-1)S.pos++;else toast("Tüm filmleri oyladın");
  renderFilm();
}
$("rate").onclick=e=>{const b=e.target.closest("button");if(b)vote(+b.dataset.v)};
$("skip").onclick=()=>vote(0);
$("prev").onclick=()=>{if(S.pos>0){S.pos--;renderFilm()}};
$("next").onclick=()=>{if(S.pos<S.order.length-1){S.pos++;renderFilm()}};
$("exit").onclick=()=>{show("sApp");renderApp()};
$("upd").onclick=()=>{calc();show("sApp");renderApp();toast("Eşleşmeler güncellendi")};

// ---- 3. E-posta ile giriş (temsili) ----
$("sendCode").onclick=()=>{
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($("mail").value.trim())){$("e2").textContent="Geçerli bir e-posta gir.";return}
  $("e2").textContent="";$("l1").classList.add("hide");$("l2").classList.remove("hide");
};
$("back1").onclick=()=>{$("l2").classList.add("hide");$("l1").classList.remove("hide")};
$("verify").onclick=()=>{
  if(!/^\d{6}$/.test($("code").value.trim())){$("e3").textContent="6 haneli kodu gir.";return}
  calc();S.mode="more";S.tab="adaylar";show("sApp");renderApp();
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
  $("hello").textContent=`Merhaba ${S.p.ad}`;
  const T=[["ilgi","Size ilgi",L.ilgi.length],["adaylar","Adaylar",L.adaylar.length],["esl","Eşleşmeler",L.esl.length]];
  $("tabs").innerHTML=T.map(t=>`<button data-t="${t[0]}" class="${S.tab===t[0]?"on":""}">${t[1]}<b>${t[2]||""}</b></button>`).join("");
  const arr=L[S.tab],head=S.tab==="adaylar"?`<div class="top" style="margin-bottom:10px"><div><h2>Bugün ${arr.length} aday</h2><p style="margin:0">Birbirinize “İlgileniyorum” dediğinizde eşleşirsiniz.</p></div></div><div class="box" style="margin-bottom:14px"><span>Daha iyi eşleşme için daha fazla film oyla, sonra eşleşmeleri güncelle.</span></div>`:S.tab==="ilgi"?`<h2 style="margin-bottom:10px">Size ilgi gösterenler</h2>`:`<h2 style="margin-bottom:10px">Eşleşmelerin</h2>`;
  $("list").innerHTML=head+(arr.length?`<div class="cards">${arr.map((c,i)=>card(c,S.tab,i===0)).join("")}</div>`:`<div class="empty">${S.tab==="esl"?"Henüz eşleşme yok. İki taraf da ilgilendiğinde burada sohbet açılır.":"Şimdilik kimse yok. Daha fazla film oyla, eşleşmeleri güncelle."}</div>`);
}
$("tabs").onclick=e=>{const b=e.target.closest("button");if(b){S.tab=b.dataset.t;renderApp()}};
$("more").onclick=()=>{S.mode="more";show("sVote");renderFilm()};
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
$("chatBack").onclick=()=>{S.tab="esl";show("sApp");renderApp()};
