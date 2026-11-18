

// Movies loaded from Supabase
let FILMS = [];

// Load real movies
async function loadMovies() {
  const { data, error } = await supabaseClient
    .from("movies")
    .select("id, title, release_year, runtime_minutes, poster_url")
    .order("imdb_rank", { ascending: true });

  if (error) {
    console.error("Movie loading error:", error);
    return false;
  }

  FILMS = data.map(movie => ({
    id: movie.id,
    t: movie.title,
    y: movie.release_year,
    g: "Film",
    d: movie.runtime_minutes,
    poster_url: movie.poster_url
  }));

  return true;
}

// Keep the existing CANDS definition below



// Temsili film ve aday verileri. Gerçek backend bağlandığında değiştirilecek.
const A=["Gece","Kızıl","Sessiz","Son","Gizli","Uzak","Mavi","Yarım"],N=["Treni","Şehir","Vals","Köprü","Sahil","Tanık","Rota","Bahçe","Mektup","Liman"],G=["Dram","Bilim Kurgu","Gerilim","Komedi","Macera","Animasyon"];
const CANDS=[["Tuğçe",29,"İstanbul",1],["Gizem",29,"Mersin",0],["Melisa",21,"Kayseri",1],["Rüveyda",29,"İstanbul",0],["Elif",26,"Ankara",0],["Zeynep",31,"İzmir",1],["Buse",24,"Adana",0],["Derya",27,"Bursa",0],["Selin",33,"Antalya",1],["Ceren",25,"Eskişehir",0],["Naz",28,"Konya",0],["Ada",30,"Samsun",0]].map((c,i)=>({id:i,n:c[0],a:c[1],c:c[2],likesYou:!!c[3]}));
