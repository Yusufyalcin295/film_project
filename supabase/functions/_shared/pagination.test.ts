
import {
  assertEquals,
  assertRejects,
} from "jsr:@std/assert";

import {
  loadActionPages,
  type UserAction,
} from "./pagination.ts";

Deno.test("loads 1500 actions across two pages", async () => {
  const actions: UserAction[] = Array.from(
    { length: 1500 },
    (_, i) => ({
      actor_id: "user-a",
      target_id: `user-${i}`,
      action: "block",
    }),
  );

  const ranges: number[][] = [];

  const result = await loadActionPages(
    async (start, end) => {
      ranges.push([start, end]);

      return {
        data: actions.slice(start, end + 1),
        error: null,
      };
    },
  );

  assertEquals(result.length, 1500);
  assertEquals(new Set(result.map((a) => a.target_id)).size, 1500);
  assertEquals(ranges, [[0, 999], [1000, 1999]]);
});

Deno.test("rejects database errors", async () => {
  await assertRejects(
    () =>
      loadActionPages(async () => ({
        data: null,
        error: { message: "Database error" },
      })),
    Error,
    "Could not load user actions",
  );
});

Deno.test("rejects when page limit is reached", async () => {
  await assertRejects(
    () =>
      loadActionPages(
        async (start, end) => ({
          data: Array.from(
            { length: end - start + 1 },
            (_, i) => ({
              actor_id: "user-a",
              target_id: `user-${start + i}`,
              action: "pass",
            }),
          ),
          error: null,
        }),
        1000,
        2,
      ),
    Error,
    "Action dataset exceeds the current limit",
  );
});
