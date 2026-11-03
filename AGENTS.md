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

- Risk scoring lives only in src/lib/risk.ts (RISK_CONFIG holds all thresholds); scores are computed client-side from play_logs so tuning needs no data migration.
- Signed-in pages live under src/routes/_authenticated/ (client-only gate, redirects to /auth); data is read with the browser client under staff-only RLS.
- Patient detail content is shared between the standalone route and the dashboard Sheet; dashboard selection is validated URL search state so reloads and alert links open the same detail without duplicating mutations.
