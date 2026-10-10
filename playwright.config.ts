import { defineConfig } from '@playwright/test';

// PW_PORT lets several checkouts/agents run e2e side by side without reusing each other's preview server.
const PORT = Number(process.env.PW_PORT ?? 4173);
// PW_DIST lets agents build into their own outDir (npx vite build --outDir dist-x) so builds don't collide.
const DIST = process.env.PW_DIST ?? 'dist';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  retries: 0,
  use: {
    baseURL: `http://localhost:${PORT}/`,
    viewport: { width: 1366, height: 768 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort --outDir ${DIST}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
