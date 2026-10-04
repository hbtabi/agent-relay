const force = process.env.FORCE_COLOR;
const enabled = !process.env.NO_COLOR && (force ? force !== "0" : Boolean(process.stdout.isTTY));

const wrap = (open: string, close = "\x1b[0m") => (s: string) => (enabled ? `${open}${s}${close}` : s);

export const c = {
  bold: wrap("\x1b[1m"),
  dim: wrap("\x1b[2m"),
  italic: wrap("\x1b[3m"),
  lime: wrap("\x1b[38;5;154m"),
  purple: wrap("\x1b[38;5;99m"),
  cyan: wrap("\x1b[38;5;45m"),
  amber: wrap("\x1b[38;5;214m"),
  red: wrap("\x1b[38;5;203m"),
  grey: wrap("\x1b[38;5;245m"),
};

const AGENT_COLOURS: Record<string, (s: string) => string> = {
  user: c.bold,
  planner: c.purple,
  researcher: c.cyan,
  writer: c.lime,
  relay: c.red,
};

export const paintAgent = (name: string) => (AGENT_COLOURS[name] ?? c.amber)(name);

// eslint-disable-next-line no-control-regex
export const visibleLength = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "").length;

export const padEnd = (s: string, n: number) => s + " ".repeat(Math.max(0, n - visibleLength(s)));

export function truncate(s: string, n: number): string {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > n ? `${flat.slice(0, n - 1)}…` : flat;
}

export function box(title: string, body: string, width = 72): string {
  const inner = width - 4;
  const lines = body.split("\n").flatMap((l) => wrapLine(l, inner));
  const top = `╭─ ${title} ${"─".repeat(Math.max(0, width - visibleLength(title) - 5))}╮`;
  const bottom = `╰${"─".repeat(width - 2)}╯`;
  return [c.grey(top), ...lines.map((l) => `${c.grey("│")} ${padEnd(l, inner)} ${c.grey("│")}`), c.grey(bottom)].join("\n");
}

function wrapLine(line: string, width: number): string[] {
  if (visibleLength(line) <= width) return [styleMarkdown(line)];
  const indent = /^\s*(- )?/.exec(line)?.[0].length ?? 0;
  const words = line.split(" ");
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > width) {
      out.push(cur);
      cur = " ".repeat(indent) + w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) out.push(cur);
  return out.map(styleMarkdown);
}

function styleMarkdown(line: string): string {
  if (line.startsWith("# ")) return c.bold(c.lime(line.slice(2)));
  if (line.startsWith("## ")) return c.bold(c.purple(line.slice(3)));
  if (line.startsWith("- ")) return `${c.lime("•")} ${line.slice(2)}`;
  return line;
}
