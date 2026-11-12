<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

(The Lovable block above dates from when this repo was built with Lovable. Whether the Lovable sync is fully disconnected is unconfirmed, so its rule still applies: never rewrite pushed history.)

- Risk scoring lives only in src/lib/risk.ts (RISK_CONFIG holds all thresholds); scores are computed client-side from play_logs so tuning needs no data migration.
- Signed-in pages live under src/routes/_authenticated/ (client-only gate, redirects to /auth). Data is read with the browser client under RLS: admins see every patient, other staff only patients linked to them in patient_staff (supabase/manual-sql/003); counselors cannot read play_logs/risk_scores/alerts and get a reduced view from server functions (009, src/lib/counselor-view.server.ts).
- There is no public sign-up. Admins create staff accounts and hand over a one-time invite code; the person sets their own password at /activate (010, src/lib/staff-account.server.ts).
- Server-only code goes in *.server.ts files via createServerFn; keep SDK imports, process.env and secret keys inside handlers. Never name a folder `server` (the Lovable vite config blocks **/server/** from the client bundle).
- Manual SQL lives in supabase/manual-sql/ in numbered order; re-run 003_staff_rls_test.sql after changing policies.
- UI copy is Korean and written like a production app; keep developer notes (SQL numbers, env var names) out of the UI.
- CLAUDE.md holds the full project notes and working rules.
- Patient detail uses one shared component in the dashboard split view; validated URL selection and legacy-detail redirects preserve reloads and alert links without duplicating mutations.
- Calendar display aggregation lives in src/lib/calendar.ts and delegates all risk calculations to risk.ts, keeping presentation changes independent of clinical scoring.
