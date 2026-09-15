import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Tests verifying the PWA/offline mode configuration is set up correctly.
 * These are structural tests — they check config files and build artifacts
 * rather than runtime behaviour (service worker runtime needs a browser).
 */

const webRoot = path.resolve(__dirname, "../..");

describe("PWA / Offline Mode", () => {
  // ===================== POSITIVE =====================

  describe("positive — manifest & config", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(webRoot, "public/manifest.json"), "utf-8"),
    );

    it("manifest.json has correct app name", () => {
      expect(manifest.name).toBe("VPC Music");
      expect(manifest.short_name).toBe("VPC Music");
    });

    it("manifest.json has standalone display mode", () => {
      expect(manifest.display).toBe("standalone");
    });

    it("manifest.json has correct theme color", () => {
      expect(manifest.theme_color).toBe("#000435");
      expect(manifest.background_color).toBe("#000435");
    });

    it("manifest.json has start_url", () => {
      expect(manifest.start_url).toBe("/");
    });

    it("manifest.json includes required icon sizes", () => {
      const sizes = manifest.icons.map((i: any) => i.sizes);
      expect(sizes).toContain("192x192");
      expect(sizes).toContain("512x512");
    });

    it("manifest.json has at least one maskable icon", () => {
      const maskable = manifest.icons.filter(
        (i: any) => i.purpose === "maskable",
      );
      expect(maskable.length).toBeGreaterThanOrEqual(1);
    });

    it("manifest.json has music category", () => {
      expect(manifest.categories).toContain("music");
    });
  });

  describe("positive — HTML meta tags", () => {
    const html = fs.readFileSync(
      path.join(webRoot, "index.html"),
      "utf-8",
    );

    it("index.html links to manifest.json", () => {
      expect(html).toContain('rel="manifest"');
      expect(html).toContain('href="/manifest.json"');
    });

    it("index.html has theme-color meta tag", () => {
      expect(html).toContain('name="theme-color"');
      expect(html).toContain('content="#000435"');
    });

    it("index.html has apple-mobile-web-app-capable", () => {
      expect(html).toContain("apple-mobile-web-app-capable");
    });

    it("index.html has apple-touch-icon", () => {
      expect(html).toContain("apple-touch-icon");
    });
  });

  describe("positive — Vite PWA config", () => {
    const viteConfig = fs.readFileSync(
      path.join(webRoot, "vite.config.ts"),
      "utf-8",
    );

    it("imports VitePWA plugin", () => {
      expect(viteConfig).toContain("VitePWA");
      expect(viteConfig).toContain("vite-plugin-pwa");
    });

    it("uses autoUpdate register type", () => {
      expect(viteConfig).toContain('registerType: "autoUpdate"');
    });

    it("configures NetworkFirst caching for API data", () => {
      expect(viteConfig).toContain('"NetworkFirst"');
      expect(viteConfig).toContain("api-data");
    });

    it("configures StaleWhileRevalidate for Google Fonts CSS", () => {
      expect(viteConfig).toContain('"StaleWhileRevalidate"');
      expect(viteConfig).toContain("google-fonts-stylesheets");
    });

    it("configures CacheFirst for Google Fonts files", () => {
      expect(viteConfig).toContain('"CacheFirst"');
      expect(viteConfig).toContain("google-fonts-webfonts");
    });

    it("never caches song media, and says so before the songs rule can claim it", () => {
      // Audio streams only, and the media route answers with a presigned URL
      // that expires in minutes. Workbox takes the FIRST matching rule, and the
      // api-data rule's pattern also matches /api/songs/:id/media/, so the
      // NetworkOnly rule has to come first or media quietly gets cached.
      const mediaRule = viteConfig.indexOf(String.raw`\/media\/`);
      const networkOnly = viteConfig.indexOf('"NetworkOnly"');
      const apiData = viteConfig.indexOf("api-data");
      expect(mediaRule).toBeGreaterThan(-1);
      expect(networkOnly).toBeGreaterThan(mediaRule);
      expect(networkOnly).toBeLessThan(apiData);
    });

    it("never caches offline mode's chart sync, which IndexedDB already keeps", () => {
      // Each ?since= would be another megabytes-sized entry in the api-data cache.
      const contentsRule = viteConfig.indexOf(String.raw`\/api\/songs\/contents`);
      const apiData = viteConfig.indexOf("api-data");
      expect(contentsRule).toBeGreaterThan(-1);
      expect(viteConfig.indexOf('"NetworkOnly"', contentsRule)).toBeGreaterThan(contentsRule);
      expect(viteConfig.indexOf('"NetworkOnly"', contentsRule)).toBeLessThan(apiData);
    });

    it("has navigateFallback configured", () => {
      expect(viteConfig).toContain("navigateFallback");
    });

    it("excludes /api/ routes from navigate fallback", () => {
      expect(viteConfig).toContain("navigateFallbackDenylist");
      expect(viteConfig).toContain("api");
    });
  });

  describe("positive — service worker registration", () => {
    const mainTsx = fs.readFileSync(
      path.join(webRoot, "src/main.tsx"),
      "utf-8",
    );

    it("imports registerSW from virtual:pwa-register", () => {
      expect(mainTsx).toContain("virtual:pwa-register");
      expect(mainTsx).toContain("registerSW");
    });

    it("calls registerSW with immediate flag", () => {
      expect(mainTsx).toContain("registerSW({ immediate: true })");
    });
  });

  describe("positive — offline fallback page", () => {
    it("offline.html exists in public directory", () => {
      const offlinePath = path.join(webRoot, "public/offline.html");
      expect(fs.existsSync(offlinePath)).toBe(true);
    });

    it("offline.html has proper branding", () => {
      const html = fs.readFileSync(
        path.join(webRoot, "public/offline.html"),
        "utf-8",
      );
      expect(html).toContain("VPC Music");
      expect(html).toContain("Offline");
      expect(html).toContain("#000435"); // navy theme
      expect(html).toContain("#ca9762"); // gold accent
    });

    it("offline.html has a reload button", () => {
      const html = fs.readFileSync(
        path.join(webRoot, "public/offline.html"),
        "utf-8",
      );
      expect(html).toContain("reload()");
      expect(html).toContain("Try Again");
    });
  });

  describe("positive — TypeScript declarations", () => {
    const envDts = fs.readFileSync(
      path.join(webRoot, "vite-env.d.ts"),
      "utf-8",
    );

    it("vite-env.d.ts includes PWA client types", () => {
      expect(envDts).toContain("vite-plugin-pwa/client");
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative — edge cases", () => {
    it("manifest.json does not have empty icons array", () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(webRoot, "public/manifest.json"), "utf-8"),
      );
      expect(manifest.icons.length).toBeGreaterThan(0);
    });

    it("manifest.json icons all have valid type", () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(webRoot, "public/manifest.json"), "utf-8"),
      );
      for (const icon of manifest.icons) {
        expect(icon.type).toBe("image/png");
      }
    });

    it("Vite config does not externalize workbox-window", () => {
      const viteConfig = fs.readFileSync(
        path.join(webRoot, "vite.config.ts"),
        "utf-8",
      );
      expect(viteConfig).not.toContain("workbox-window");
    });
  });
});
