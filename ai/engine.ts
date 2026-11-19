// Genel eşleştirme motoru: aday bulma, sıralama, beğeni/eşleşme ve film akışı.
// Skor yalnızca film puanlarına dayanır (matching.ts); profil bilgisi skora etki etmez.

import { matchScore, MIN_COMMON, MIN_RATED_TO_UNLOCK, Ratings, MatchResult } from "./matching.ts";
export interface User {
  id: string;
  ratings: Ratings;      // yalnızca puanlanan filmler (izlemedim yok)
  blocked: Set<string>;  // bu kullanıcının engellediği kullanıcılar
  passed: Set<string>;   // "Geç" dediği kullanıcılar
  liked: Set<string>;    // beğendiği kullanıcılar
}
export type UserMap = Map<string, User>;

export const isUnlocked = (u: User) => u.ratings.size >= MIN_RATED_TO_UNLOCK;

// 1) Ters indeks: film -> bu filmi puanlayan (eşleşmeye açık) kullanıcılar.
// Böylece her kullanıcıyı herkesle değil, sadece ortak filmi olanlarla karşılaştırırız.
export function buildIndex(users: Iterable<User>): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const u of users) {
    if (!isUnlocked(u)) continue;
    for (const movieId of u.ratings.keys()) {
      const list = index.get(movieId);
      if (list) list.push(u.id);
      else index.set(movieId, [u.id]);
    }
  }
  return index;
}

// 2) Aday üretimi: en az MIN_COMMON ortak filmi olan kullanıcılar.
export function findCandidates(me: User, index: Map<string, string[]>): string[] {
  const counts = new Map<string, number>();
  for (const movieId of me.ratings.keys()) {
    for (const id of index.get(movieId) ?? []) {
      if (id !== me.id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts].filter(([, c]) => c >= MIN_COMMON).map(([id]) => id);
}

// 3) Uygunluk filtresi (skoru etkilemez, sadece listeden çıkarır).
export function isEligible(me: User, other: User): boolean {
  return (
    isUnlocked(other) &&
    !me.blocked.has(other.id) &&
    !other.blocked.has(me.id) &&
    !me.passed.has(other.id) &&
    !other.passed.has(me.id) &&
    !me.liked.has(other.id)
  );
}


export interface Ranked { userId: string; result: MatchResult }

// 4) Skorla ve sırala: yüzde, sonra ortak film sayısı, sonra id (deterministik).
export function rankCandidates(me: User, users: UserMap, index: Map<string, string[]>, limit = 20): Ranked[] {
  if (!isUnlocked(me)) return [];
  const out: Ranked[] = [];
  for (const id of findCandidates(me, index)) {
    const other = users.get(id);
    if (!other || !isEligible(me, other)) continue;
    const result = matchScore(me.ratings, other.ratings);
    if (result) out.push({ userId: id, result });
  }
  out.sort(
    (a, b) =>
      b.result.percent - a.result.percent ||
      b.result.commonCount - a.result.commonCount ||
      a.userId.localeCompare(b.userId)
  );
  return out.slice(0, limit);
}

// 5) Beğeni: karşılıklıysa eşleşme oluşur (sunucuda çalıştırılmalı).
export const likeKey = (from: string, to: string) => `${from}>${to}`;

export function registerLike(likes: Set<string>, from: string, to: string, users: UserMap) {
  const a = users.get(from);
  const b = users.get(to);
  if (
    !a || !b || from === to ||
    !isUnlocked(a) || !isUnlocked(b) ||
    a.blocked.has(to) || b.blocked.has(from) ||
    a.passed.has(to) || b.passed.has(from) ||
    !matchScore(a.ratings, b.ratings)
  ) {
    return { ok: false, mutual: false };
  }
  likes.add(likeKey(from, to));
  a.liked.add(to);
  return { ok: true, mutual: likes.has(likeKey(to, from)) };
}

// Eşleşme belgesi: skorun hangi filmlere dayandığı da kaydedilir.
export function createMatch(a: User, b: User) {
  const r = matchScore(a.ratings, b.ratings);
  if (!r) return null;
  return {
    userIds: [a.id, b.id].sort(),
    percent: r.percent,
    commonCount: r.commonCount,
    films: r.films.map((f) => ({ movieId: f.movieId, s: f.s, ratings: { [a.id]: f.ra, [b.id]: f.rb } })),
  };
}

// 6) Film akışı: popülerlik ağırlıklı rastgele seçim (kesişimi artırır).
// İlk 10 puana kadar yalnızca en popüler coreSize film arasından seçilir.
export interface CatalogFilm { movieId: string; votes: number }

export function nextFilms(
  catalog: CatalogFilm[],
  me: User,
  skipped: Set<string>, // "izlemedim" denen filmler
  n = 5,
  rng: () => number = Math.random,
  coreSize = 40
): string[] {
  let pool = catalog.filter((f) => !me.ratings.has(f.movieId) && !skipped.has(f.movieId));
  if (me.ratings.size < MIN_RATED_TO_UNLOCK) {
    const core = new Set([...catalog].sort((a, b) => b.votes - a.votes).slice(0, coreSize).map((f) => f.movieId));
    const corePool = pool.filter((f) => core.has(f.movieId));
    if (corePool.length >= n) pool = corePool;
  }
  // Ağırlıklı örnekleme (Efraimidis–Spirakis): anahtar = u^(1/w), en büyük n anahtar.
  return pool
    .map((f) => ({ id: f.movieId, key: Math.pow(rng(), 1 / Math.sqrt(Math.max(f.votes, 1))) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map((x) => x.id);
}
