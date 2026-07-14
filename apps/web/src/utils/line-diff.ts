export type DiffLine = { type: "same" | "add" | "remove"; text: string };

/**
 * Line-level diff via longest-common-subsequence. Small enough for song charts
 * (a few hundred lines). "remove" = in `a` (original) only, "add" = in `b`
 * (the new version) only.
 */
export function diffLines(a: string, b: string): DiffLine[] {
  const aLines = a.replace(/\r\n/g, "\n").split("\n");
  const bLines = b.replace(/\r\n/g, "\n").split("\n");
  const n = aLines.length;
  const m = bLines.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      out.push({ type: "same", text: aLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ type: "remove", text: aLines[i] });
      i++;
    } else {
      out.push({ type: "add", text: bLines[j] });
      j++;
    }
  }
  while (i < n) out.push({ type: "remove", text: aLines[i++] });
  while (j < m) out.push({ type: "add", text: bLines[j++] });
  return out;
}

export function countDiff(lines: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.type === "add") added++;
    else if (l.type === "remove") removed++;
  }
  return { added, removed };
}
