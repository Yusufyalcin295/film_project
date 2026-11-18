import { describe, it, expect } from "vitest";
import { matchScore, Ratings } from "./matching";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `m${i}`);
const uniform = (n: number, r: number): Ratings =>
  new Map(ids(n).map((id) => [id, r] as [string, number]));

describe("matchScore", () => {
  it("3 filmden az ortak filmde null döner", () => {
    expect(matchScore(uniform(2, 5), uniform(2, 5))).toBeNull();
  });

  it("izlemedim (Map'te olmayan) filmler hesaba girmez", () => {
    const a: Ratings = new Map([["x", 5], ["y", 5], ["z", 5], ["only-a", 1]]);
    const b: Ratings = new Map([["x", 5], ["y", 5], ["z", 5], ["only-b", 5]]);
    expect(matchScore(a, b)!.commonCount).toBe(3);
  });

  it("simetriktir: skor(A,B) = skor(B,A)", () => {
    const a: Ratings = new Map([["x", 5], ["y", 2], ["z", 4], ["t", 1]]);
    const b: Ratings = new Map([["x", 4], ["y", 5], ["z", 4], ["t", 1]]);
    expect(matchScore(a, b)!.percent).toBe(matchScore(b, a)!.percent);
  });

  it("aynı uyumda daha çok ortak film daha yüksek skor verir", () => {
    const few = matchScore(uniform(3, 5), uniform(3, 5))!;
    const many = matchScore(uniform(10, 5), uniform(10, 5))!;
    expect(many.percent).toBeGreaterThan(few.percent);
    expect(many.percent).toBeGreaterThanOrEqual(85);
  });

  it("çok ortak film olsa bile zıt zevk düşük skor alır", () => {
    const opposite = matchScore(uniform(20, 5), uniform(20, 1))!;
    const fewAgree = matchScore(uniform(3, 5), uniform(3, 5))!;
    expect(opposite.percent).toBeLessThan(20);
    expect(opposite.percent).toBeLessThan(fewAgree.percent);
  });

  it("fark arttıkça skor düşer", () => {
    const base = uniform(6, 5);
    const diffs = [5, 4, 3, 2, 1].map(
      (r) => matchScore(base, uniform(6, r))!.percent
    );
    for (let i = 1; i < diffs.length; i++) {
      expect(diffs[i]).toBeLessThan(diffs[i - 1]);
    }
  });

  it("güven etiketi ortak film sayısına göre değişir", () => {
    expect(matchScore(uniform(3, 4), uniform(3, 4))!.confidence).toBe("düşük");
    expect(matchScore(uniform(6, 4), uniform(6, 4))!.confidence).toBe("orta");
    expect(matchScore(uniform(9, 4), uniform(9, 4))!.confidence).toBe("yüksek");
  });

  it("uyum ve ayrışma listelerini ayırır", () => {
    const a: Ratings = new Map([["love", 5], ["fight", 5], ["x", 3], ["y", 3]]);
    const b: Ratings = new Map([["love", 5], ["fight", 1], ["x", 3], ["y", 3]]);
    const r = matchScore(a, b)!;
    expect(r.agreements.map((f) => f.movieId)).toEqual(["love"]);
    expect(r.disagreements.map((f) => f.movieId)).toEqual(["fight"]);
  });
});


describe("invalid rating handling", () => {
  it("rejects 0, 6, decimals and NaN rather than creating NaN scores", () => {
    for (const bad of [0, 6, 2.5, NaN]) {
      const a = new Map([["x", bad], ["y", 4], ["z", 4]]);
      const b = new Map([["x", 4], ["y", 4], ["z", 4]]);
      expect(() => matchScore(a, b)).toThrow(RangeError);
    }
  });
  it("rejects negative confidence weight", () => {
    expect(() => matchScore(uniform(3, 5), uniform(3, 5), -1)).toThrow(RangeError);
  });
  it("does not use non-common movies in score", () => {
    const a = new Map([["x", 5], ["y", 5], ["z", 5], ["only-a", 1]]);
    const b = new Map([["x", 5], ["y", 5], ["z", 5]]);
    const r = matchScore(a, b)!;
    expect(r.commonCount).toBe(3);
    expect(r.films.map((f) => f.movieId).sort()).toEqual(["x", "y", "z"]);
  });
});
