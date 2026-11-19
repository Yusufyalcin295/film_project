import { describe, it, expect } from "vitest";
import { User, UserMap, buildIndex, rankCandidates, registerLike, createMatch, nextFilms, CatalogFilm } from "./engine";

const mk = (id: string, ratings: Record<string, number>): User => ({
  id,
  ratings: new Map(Object.entries(ratings)),
  blocked: new Set(),
  passed: new Set(),
  liked: new Set(),
});
const film = (prefix: string, from: number, count: number, r: number) =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`${prefix}${from + i}`, r]));

function setup() {
  const me = mk("me", film("m", 0, 10, 5));
  const agree = mk("agree", film("m", 0, 10, 5));
  const opposite = mk("opposite", film("m", 0, 10, 1));
  const noOverlap = mk("noOverlap", film("m", 20, 10, 5));
  const locked = mk("locked", film("m", 0, 5, 5)); // 10'dan az puan
  const users: UserMap = new Map([me, agree, opposite, noOverlap, locked].map((u) => [u.id, u]));
  return { me, agree, opposite, noOverlap, locked, users, index: buildIndex(users.values()) };
}

describe("rankCandidates", () => {
  it("uyumlu olanı öne koyar; kesişimi olmayan ve kilitli kullanıcıyı dışlar", () => {
    const { me, users, index } = setup();
    const ids = rankCandidates(me, users, index).map((r) => r.userId);
    expect(ids).toEqual(["agree", "opposite"]);
  });

  it("10 puanı tamamlamamış kullanıcıya aday göstermez", () => {
    const { locked, users, index } = setup();
    expect(rankCandidates(locked, users, index)).toEqual([]);
  });

  it("engellenen ve geçilen kullanıcıları göstermez", () => {
    const { me, users, index } = setup();
    me.blocked.add("opposite");
    me.passed.add("agree");
    expect(rankCandidates(me, users, index)).toEqual([]);
  });

  it("karşı taraf engellediyse de göstermez", () => {
    const { me, agree, users, index } = setup();
    agree.blocked.add("me");
    expect(rankCandidates(me, users, index).map((r) => r.userId)).toEqual(["opposite"]);
  });


  it("does not recommend users who passed on me", () => {
    const { me, agree, users, index } = setup();

    // The other user passed on me.
    agree.passed.add(me.id);

    const candidates = rankCandidates(me, users, index);
    const ids = candidates.map((candidate) => candidate.userId);

    expect(ids).not.toContain(agree.id);
    expect(ids).toEqual(["opposite"]);
});

});

describe("beğeni ve eşleşme", () => {
  it("karşılıklı beğenide eşleşme oluşur ve film kanıtı saklanır", () => {
    const { me, agree, users } = setup();
    const likes = new Set<string>();
    expect(registerLike(likes, "me", "agree", users).mutual).toBe(false);
    expect(registerLike(likes, "agree", "me", users).mutual).toBe(true);
    const m = createMatch(me, agree)!;
    expect(m.userIds).toEqual(["agree", "me"]);
    expect(m.commonCount).toBe(10);
    expect(m.films[0].ratings).toEqual({ me: 5, agree: 5 });
  });

  it("engelli kullanıcıya beğeni kaydedilmez", () => {
    const { agree, users } = setup();
    agree.blocked.add("me");
    expect(registerLike(new Set(), "me", "agree", users).ok).toBe(false);
  });
});

describe("nextFilms", () => {
  const catalog: CatalogFilm[] = Array.from({ length: 250 }, (_, i) => ({ movieId: `f${i}`, votes: 1_000_000 - i * 3000 }));

  it("puanlanmış ve izlemedim denen filmleri vermez, tekrar etmez", () => {
    const me = mk("me", { f0: 5, f1: 4 });
    const skipped = new Set(["f2", "f3"]);
    const out = nextFilms(catalog, me, skipped, 10);
    expect(new Set(out).size).toBe(10);
    for (const id of ["f0", "f1", "f2", "f3"]) expect(out).not.toContain(id);
  });

  it("10 puandan önce yalnızca en popüler 40 film arasından seçer", () => {
    const me = mk("me", {});
    for (let t = 0; t < 20; t++) {
      for (const id of nextFilms(catalog, me, new Set(), 5)) {
        expect(Number(id.slice(1))).toBeLessThan(40);
      }
    }
  });
});


describe("like eligibility requirements", () => {
  it("does not allow a like if one user has fewer than 10 rated movies", () => {
    const { me, locked, users } = setup();
    expect(registerLike(new Set(), me.id, locked.id, users).ok).toBe(false);
  });
  it("does not allow a like if there are fewer than 3 common movies", () => {
    const { me, noOverlap, users } = setup();
    expect(registerLike(new Set(), me.id, noOverlap.id, users).ok).toBe(false);
  });
  it("does not allow a like after a pass", () => {
    const { me, agree, users } = setup();
    me.passed.add(agree.id);
    expect(registerLike(new Set(), me.id, agree.id, users).ok).toBe(false);
  });
  it("does not allow self-liking", () => {
    const { me, users } = setup();
    expect(registerLike(new Set(), me.id, me.id, users).ok).toBe(false);
  });
});
