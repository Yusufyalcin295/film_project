// Temsili film ve aday verileri. Gerçek backend bağlandığında değiştirilecek.
const A=["Gece","Kızıl","Sessiz","Son","Gizli","Uzak","Mavi","Yarım"],N=["Treni","Şehir","Vals","Köprü","Sahil","Tanık","Rota","Bahçe","Mektup","Liman"],G=["Dram","Bilim Kurgu","Gerilim","Komedi","Macera","Animasyon"];
const FILMS=Array.from({length:40},(_,i)=>({id:i,t:A[i%8]+" "+N[i%10],y:1995+(i*7)%30,g:G[i%6],d:90+(i*11)%60}));
const CANDS=[["Tuğçe",29,"İstanbul",1],["Gizem",29,"Mersin",0],["Melisa",21,"Kayseri",1],["Rüveyda",29,"İstanbul",0],["Elif",26,"Ankara",0],["Zeynep",31,"İzmir",1],["Buse",24,"Adana",0],["Derya",27,"Bursa",0],["Selin",33,"Antalya",1],["Ceren",25,"Eskişehir",0],["Naz",28,"Konya",0],["Ada",30,"Samsun",0]].map((c,i)=>({id:i,n:c[0],a:c[1],c:c[2],likesYou:!!c[3]}));
