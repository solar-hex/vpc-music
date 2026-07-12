import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // Heavy jsdom + userEvent tests (char-by-char typing) can run 4s+ on their
    // own; under full parallel load, contention pushes borderline tests past the
    // 5s default. Give headroom so timing flakes don't fail the suite.
    testTimeout: 15000,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: false,
    // Tests assume same-origin /api URLs — don't let a developer's
    // .env.local (VITE_API_URL) leak into assertions.
    env: { VITE_API_URL: "" },
  },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
