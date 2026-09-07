import { describe, it, expect } from "vitest";
import { router } from "@/router";

function shellRoute() {
  return router.routes.find((route) => !route.path && route.children && route.children.length > 1);
}

describe("router configuration", () => {
  it("exports a router object", () => {
    expect(router).toBeDefined();
  });

  it("has a root route that sends signed-in users to the song list", () => {
    expect(router.routes.find((route) => route.path === "/")).toBeDefined();
  });

  it("keeps the public auth and share routes", () => {
    const paths = router.routes.map((route) => route.path);
    expect(paths).toEqual(expect.arrayContaining(["/login", "/forgot-password", "/reset-password", "/shared/:token", "/shared/setlist/:token"]));
    expect(paths).not.toContain("/register");
  });

  it("renders the chart at the top level, outside the shell, and redirects the old focus URL", () => {
    expect(router.routes.find((route) => route.path === "/songs/:id")).toBeDefined();
    expect(router.routes.find((route) => route.path === "/songs/:id/focus")).toBeDefined();
    expect(shellRoute()?.children?.map((child) => child.path)).not.toContain("/songs/:id");
  });

  it("has only the tranche-1 pages inside the shell, plus redirects for old bookmarks", () => {
    const childPaths = shellRoute()?.children?.map((child) => child.path);
    expect(childPaths).toEqual(
      expect.arrayContaining(["/songs", "/songs/new", "/songs/:id/edit", "/settings", "/settings/*", "/dashboard/*", "/admin/*", "*"]),
    );
    for (const removed of ["/dashboard", "/setlists", "/artists", "/admin", "/songs/media"]) {
      expect(childPaths).not.toContain(removed);
    }
  });
});
