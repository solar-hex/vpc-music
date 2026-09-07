import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { convertChrdLibrary, defaultChrdMigrationPaths } from "./migrate-chrd-library.mjs";

const tempDirs = [];

async function createTempRoot() {
  const dir = await mkdtemp(join(tmpdir(), "vpc-music-chrd-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    await rm(dir, { recursive: true, force: true });
  }
});

describe("migrate-chrd-library", () => {
  it("converts nested .chrd files and preserves relative folders", async () => {
    const root = await createTempRoot();
    const inputDir = join(root, "songList");
    const outputDir = join(root, "converted");

    await mkdir(join(inputDir, "seasonal"), { recursive: true });
    await writeFile(
      join(inputDir, "amazing-grace.chrd"),
      [
        "Amazing Grace",
        "G",
        "Author: John Newton",
        "",
        "Verse 1",
        "#G       C",
        "@Amazing grace",
      ].join("\n"),
      "utf-8"
    );
    await writeFile(
      join(inputDir, "seasonal", "advent-song.chrd"),
      [
        "~Advent Song",
        "D",
        "",
        "Verse",
        "#D      G",
        "^Bm     A",
        "@Lift your eyes",
      ].join("\n"),
      "utf-8"
    );
    await writeFile(join(inputDir, "ignore.txt"), "noop", "utf-8");

    const summary = await convertChrdLibrary({ inputDir, outputDir });

    expect(summary.convertedCount).toBe(2);
    expect(summary.failedCount).toBe(0);
    expect(summary.warningCount).toBe(0);
    expect(existsSync(join(outputDir, "amazing-grace.chopro"))).toBe(true);
    expect(existsSync(join(outputDir, "seasonal", "advent-song.chopro"))).toBe(true);
    expect(existsSync(join(outputDir, "migration-report.json"))).toBe(true);
    expect(existsSync(join(outputDir, "migration-report.txt"))).toBe(true);

    const converted = await readFile(join(outputDir, "amazing-grace.chopro"), "utf-8");
    expect(converted).toContain("{title: Amazing Grace}");
    expect(converted).toContain("{artist: John Newton}");
    expect(converted).toContain("[G]Amazing [C]grace");

    const nested = await readFile(join(outputDir, "seasonal", "advent-song.chopro"), "utf-8");
    expect(nested).toContain("{title: Advent Song}");
    expect(nested).toContain("[*Bm][D]Lift yo[*A][G]ur eyes");
    expect(nested).not.toContain("Secondary chords");

    const jsonReport = JSON.parse(await readFile(join(outputDir, "migration-report.json"), "utf-8"));
    expect(jsonReport.convertedCount).toBe(2);
    expect(jsonReport.failedCount).toBe(0);
    expect(jsonReport.warningCount).toBe(0);
    expect(jsonReport.files).toHaveLength(2);
    expect(jsonReport.files[0]).toEqual(expect.objectContaining({
      relativeSourcePath: "amazing-grace.chrd",
      relativeOutputPath: "amazing-grace.chopro",
    }));

    const textReport = await readFile(join(outputDir, "migration-report.txt"), "utf-8");
    expect(textReport).toContain("VPC Music .chrd Migration Report");
    expect(textReport).toContain("- Converted: 2");
    expect(textReport).toContain("seasonal/advent-song.chrd -> seasonal/advent-song.chopro");
  });

  it("defaults the output directory to a songList-chordpro sibling", () => {
    const paths = defaultChrdMigrationPaths("C:/temp/songList");

    expect(paths.inputDir.replace(/\\/g, "/")).toBe("C:/temp/songList");
    expect(paths.outputDir.replace(/\\/g, "/")).toBe("C:/temp/songList-chordpro");
  });

  it("throws when the input directory is missing", async () => {
    await expect(convertChrdLibrary({ inputDir: join(tmpdir(), "does-not-exist-vpc-music") }))
      .rejects
      .toThrow("Input directory does not exist");
  });
});