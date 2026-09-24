# PostgreSQL setup for Kolosseum

Kolosseum stores reports, payment references, channels, and votes in new `dr_` tables. KOL and X post data remain in the existing Radar API and R2; the migration does not copy or modify them.

1. Create a PostgreSQL database with your provider. A name such as `kolosseum_demo` is suitable for the app. Copy its connection string in the form `postgresql://USER:PASSWORD@HOST/DB?sslmode=require` when your provider requires TLS.
2. Add `DATABASE_URL=<your connection string>` to `D:\VibeCode\Kolosseum\.env.local`. The file is Git-ignored. Keep its existing `REPORT_ENC_KEY`, `ADMIN_TOKEN`, and `OPERATOR_KEYPAIR_PATH` values. Never commit or paste credentials into chat.
3. From `D:\VibeCode\Kolosseum`, run `npm run research:migrate`. A successful run prints `Applied dr_ migration and seeded three templates.` The migration creates `dr_templates`, `dr_reports`, `dr_votes`, `dr_channels`, and `dr_evidence_jobs` only.
4. Run `npm run research:dev` and open `http://127.0.0.1:4174/templates`. When the database is reachable, the API returns the three research templates.

For the purchase-backed vote integration test, create a **separate** disposable PostgreSQL database named exactly `kolosseum_test`. Put its connection string in `TEST_DATABASE_URL` in `.env.local`, then run:

```powershell
npx vitest run lib/research/db.vote.integration.test.ts
```

The test refuses a URL whose database name is not `kolosseum_test` or matches `DATABASE_URL`. It applies the same `dr_` migration to the test database, inserts one temporary report, verifies payment and vote constraints, and deletes that report and its vote afterward. It leaves the three seeded templates. Without `TEST_DATABASE_URL`, Vitest marks this one test as skipped. Do not point `TEST_DATABASE_URL` at your app database.
