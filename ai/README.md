# Film Buddy — AI matching unit tests

These files are based on the previously shared `matching.ts`, `engine.ts`, and Vitest tests.

## Running in PyCharm (Windows PowerShell)

From the existing `film_project` repository root:

```powershell
node -v
npm -v
cd ai
npm install
npm run check
```

`npm run check` first checks TypeScript types, then runs unit tests.
`npm run test:watch` reruns tests automatically while you edit.

## What's included

- `matching.ts`: score based only on commonly rated movies; at least 3 common movies for a percentage
- `engine.ts`: candidate indexing and ranking, likes, match evidence, and weighted movie selection
- `*.test.ts`: unit tests, including additional checks for invalid ratings and minimum eligibility
- `package.json`, `tsconfig.json`: isolated test tooling in `ai/`

Compared with the original supplied code, the score logic is unchanged, but invalid ratings now throw `RangeError`; liking a user is rejected unless both have rated >=10 movies and share >=3 rated movies. Passes and blocks are also checked.

These tests do not connect to Supabase. A secure server-side RPC/Edge Function must verify the authenticated user, query `user_movies`, enforce access permissions, and handle likes atomically. Do not expose other users' raw ratings through unrestricted frontend queries.

Keep `ai/matching-algorithm` checked out while adding these files. Commit only after successful tests.
