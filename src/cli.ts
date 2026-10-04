#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { box, c, padEnd, paintAgent, truncate } from "./cli/format.js";
import type { Message } from "./core/message.js";
import { createDefaultRelay } from "./index.js";
import { createProvider } from "./providers/index.js";

const HELP = `
${c.bold("agent-relay")} - planner → researcher → writer, relaying messages over a bus

${c.bold("Usage")}
  agent-relay "<goal>" [options]

${c.bold("Options")}
  -p, --provider <name>   mock (default, offline) | openai (uses OPENAI_API_KEY)
  -l, --latency <ms>      simulated latency for the mock provider (default 120 in TTY, else 0)
  -o, --out <file>        also write the final brief to a Markdown file
      --max-hops <n>      safety limit on routed messages (default 50)
      --json              print the full run (messages + output) as JSON
  -q, --quiet             only print the final output
  -h, --help              show this help
`;

const KIND_STYLE: Record<Message["kind"], (s: string) => string> = {
  task: c.amber,
  result: c.cyan,
  note: c.grey,
  final: c.lime,
  error: c.red,
};

async function main(): Promise<number> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      provider: { type: "string", short: "p", default: "mock" },
      latency: { type: "string", short: "l" },
      out: { type: "string", short: "o" },
      "max-hops": { type: "string", default: "50" },
      json: { type: "boolean", default: false },
      quiet: { type: "boolean", short: "q", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(HELP);
    return 0;
  }
  const goal = positionals.join(" ").trim() || "Launch plan for a London AI video studio";
  const latency = values.latency !== undefined ? Number(values.latency) : process.stdout.isTTY ? 120 : 0;
  const llm = createProvider(values.provider!, { latencyMs: latency });
  const relay = createDefaultRelay(llm, Number(values["max-hops"]));
  const pretty = !values.json && !values.quiet;

  if (pretty) {
    console.log();
    console.log(`  ${c.lime("▲")} ${c.bold("agent-relay")} ${c.dim(`· provider=${llm.name}`)}`);
    console.log(`  ${c.dim("goal")}  ${c.italic(goal)}`);
    console.log();
    for (const a of relay.roster) console.log(`  ${a.icon} ${padEnd(paintAgent(a.name), 12)} ${c.dim(a.role)}`);
    console.log(`\n  ${c.dim("─".repeat(68))}`);
    const t0 = Date.now();
    relay.bus.subscribe((m) => {
      const t = c.dim(`+${String(Date.now() - t0).padStart(4)}ms`);
      const route = `${padEnd(paintAgent(m.from), 10)} ${c.dim("─▶")} ${padEnd(paintAgent(m.to), 10)}`;
      const kind = padEnd(KIND_STYLE[m.kind](m.kind), 6);
      const text = m.kind === "final" ? c.dim("(brief delivered)") : truncate(m.content, 34);
      console.log(`  ${c.dim(m.id)} ${t}  ${route} ${kind} ${text}`);
    });
  }

  const result = await relay.run(goal);

  if (values.out && result.output) writeFileSync(values.out, `${result.output}\n`);

  if (values.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (values.quiet) {
    console.log(result.output ?? "");
  } else {
    console.log(`  ${c.dim("─".repeat(68))}\n`);
    console.log(box(c.bold("final brief"), result.output ?? "(no output)"));
    const agents = new Set(result.messages.map((m) => m.from).filter((f) => f !== "user"));
    console.log(
      `\n  ${c.lime("✓")} ${result.messages.length} messages · ${agents.size} agents · ${result.hops} hops · ${Math.round(result.durationMs)}ms` +
        (values.out ? c.dim(` · saved to ${values.out}`) : ""),
    );
    console.log();
  }
  return result.output ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (err: Error) => {
    console.error(c.red(`✗ ${err.message}`));
    process.exit(1);
  },
);
