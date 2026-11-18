// Film puanı benzerliğine dayalı eşleşme skoru (profil bilgisi skora etki etmez).
// "İzlemedim" filmler Map içinde yer almaz; puanlar 1–5 tam sayıdır.

export type Ratings = Map<string, number>;

export interface FilmEvidence {
  movieId: string;
  ra: number; // A kullanıcısının puanı
  rb: number; // B kullanıcısının puanı
  s: number;  // puan benzerliği (0–1)
  w: number;  // uç puan ağırlığı (1–1.5)
}

export interface MatchResult {
  percent: number;
  commonCount: number;
  confidence: "düşük" | "orta" | "yüksek";
  films: FilmEvidence[];       // en uyumlu önce
  agreements: FilmEvidence[];  // ikisi de 4–5 vermiş
  disagreements: FilmEvidence[]; // fark >= 3
}

export const SIM = [1, 0.8, 0.4, 0.1, 0] as const; // fark 0..4
export const MIN_COMMON = 3;
export const MIN_RATED_TO_UNLOCK = 10;

// Do not trust values arriving from a database or a client request.
// "Not watched" is represented by an absent Map entry, never by 0.
function validateRatings(ratings: Ratings): void {
  for (const rating of ratings.values()) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new RangeError("Film ratings must be whole numbers from 1 to 5");
    }
  }
}

export function matchScore(a: Ratings, b: Ratings, k = 4): MatchResult | null {
  validateRatings(a);
  validateRatings(b);
  if (!Number.isFinite(k) || k < 0) {
    throw new RangeError("Confidence parameter k must be a finite number >= 0");
  }
  let sumW = 0;
  let sumWS = 0;
  const films: FilmEvidence[] = [];

  for (const [movieId, ra] of a) {
    const rb = b.get(movieId);
    if (rb === undefined) continue;
    const s = SIM[Math.abs(ra - rb)];
    const w = 1 + 0.5 * ((Math.abs(ra - 3) + Math.abs(rb - 3)) / 4);
    sumW += w;
    sumWS += w * s;
    films.push({ movieId, ra, rb, s, w });
  }

  const n = films.length;
  if (n < MIN_COMMON) return null;

  const S = (sumWS + k * 0.5) / (sumW + k);
  films.sort((x, y) => y.w * y.s - x.w * x.s);

  return {
    percent: Math.round(S * 100),
    commonCount: n,
    confidence: n >= 8 ? "yüksek" : n >= 5 ? "orta" : "düşük",
    films,
    agreements: films.filter((f) => f.ra >= 4 && f.rb >= 4),
    disagreements: films.filter((f) => Math.abs(f.ra - f.rb) >= 3),
  };
}
