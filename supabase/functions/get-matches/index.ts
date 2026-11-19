import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";


import {
  buildIndex,
  rankCandidates,
  type UserMap,
} from "../_shared/engine.ts";

import { loadActionPages } from "../_shared/pagination.ts";

const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

export default {
  fetch: withSupabase({ auth: "user" }, async (_req, ctx) => {
    const userId = ctx.userClaims?.id;

    if (!userId) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    // Check the current user's profile.
    const { data: profile, error: profileError } =
      await ctx.supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .single();

    if (profileError || !profile) {
      return Response.json(
        { error: "Profile not found" },
        { status: 404 },
      );
    }

    const users: UserMap = new Map();

    // Load ratings on the server only.
    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await ctx.supabaseAdmin
        .from("user_movies")
        .select("user_id, movie_id, rating")
        .not("rating", "is", null)
        .order("user_id")
        .order("movie_id")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) {
        console.error("Rating query failed:", error.message);

        return Response.json(
          { error: "Could not load ratings" },
          { status: 500 },
        );
      }

      for (const row of data ?? []) {
        if (
          !Number.isInteger(row.rating) ||
          row.rating < 1 ||
          row.rating > 5
        ) {
          continue;
        }

        let user = users.get(row.user_id);

        if (!user) {
          user = {
            id: row.user_id,
            ratings: new Map<string, number>(),
            blocked: new Set<string>(),
            passed: new Set<string>(),
            liked: new Set<string>(),
          };

          users.set(row.user_id, user);
        }

        user.ratings.set(String(row.movie_id), row.rating);
      }

      if ((data?.length ?? 0) < PAGE_SIZE) break;

      if (page === MAX_PAGES - 1) {
        return Response.json(
          { error: "Rating dataset exceeds the current limit" },
          { status: 503 },
        );
      }
    }



    // Load all actions affecting the current user.
    let actions;

    try {
      actions = await loadActionPages(
        async (start, end) => {
          const { data, error } = await ctx.supabaseAdmin
            .from("user_actions")
            .select("actor_id, target_id, action")
            .or(`actor_id.eq.${userId},target_id.eq.${userId}`)
            .order("actor_id")
            .order("target_id")
            .range(start, end);

          return { data, error };
        },
        PAGE_SIZE,
        MAX_PAGES,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      console.error("Action pagination failed:", message);

      const limitExceeded = message ===
        "Action dataset exceeds the current limit";

      return Response.json(
        {
          error: limitExceeded
            ? "Action dataset exceeds the current limit"
            : "Could not load user actions",
        },
        { status: limitExceeded ? 503 : 500 },
      );
    }


    // Fill the AI engine's action sets.
    for (const action of actions ?? []) {
      const actor = users.get(action.actor_id);

      if (!actor) continue;

      if (action.action === "block") {
        actor.blocked.add(action.target_id);
      }

      if (action.action === "pass") {
        actor.passed.add(action.target_id);
      }

      if (action.action === "like") {
        actor.liked.add(action.target_id);
      }
    }


    const me = users.get(userId);

    if (!me || me.ratings.size < 10) {
      return Response.json({
        success: true,
        matchingUnlocked: false,
        ratedCount: me?.ratings.size ?? 0,
        matches: [],
      });
    }

    // Calculate matches with Yusuf's algorithm.
    const index = buildIndex(users.values());
    const ranked = rankCandidates(me, users, index, 20);

    if (ranked.length === 0) {
      return Response.json({
        success: true,
        matchingUnlocked: true,
        ratedCount: me.ratings.size,
        matches: [],
      });
    }

    // Load only the candidate profile fields needed by the UI.
    const candidateIds = ranked.map((item) => item.userId);

    const { data: profiles, error: candidatesError } =
      await ctx.supabaseAdmin
        .from("profiles")
        .select("id, first_name, age, city")
        .in("id", candidateIds);

    if (candidatesError) {
      console.error("Profile query failed:", candidatesError.message);

      return Response.json(
        { error: "Could not load candidate profiles" },
        { status: 500 },
      );
    }

    const profileMap = new Map(
      (profiles ?? []).map((item) => [item.id, item]),
    );

    const matches = ranked.flatMap((item) => {
      const candidate = profileMap.get(item.userId);

      if (!candidate) return [];

      return [{
        userId: item.userId,
        firstName: candidate.first_name,
        age: candidate.age,
        city: candidate.city,
        percent: item.result.percent,
        commonCount: item.result.commonCount,
        confidence: item.result.confidence,
      }];
    });

    return Response.json({
      success: true,
      matchingUnlocked: true,
      ratedCount: me.ratings.size,
      matches,
    });
  }),
};
