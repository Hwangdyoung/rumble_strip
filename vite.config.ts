// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Vercel 배포 시 Cron 등록. Nitro가 .vercel/output/config.json을 직접 만들기 때문에
  // vercel.json의 crons는 적용되지 않는다. 매일 UTC 0시(한국 9시대)에 매일 점검 주소를 부른다.
  // (Lovable 설정의 nitro 타입에는 vercel 항목이 없어서 타입만 맞춰 넘긴다. 실제로는 Nitro에 그대로 전달된다)
  nitro: {
    vercel: {
      config: {
        crons: [{ path: "/api/daily-check", schedule: "0 0 * * *" }],
      },
    },
  } as unknown as { preset?: string },
});
