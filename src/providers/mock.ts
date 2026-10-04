import type { CompletionRequest, LLMProvider } from "./types.js";

/**
 * A deterministic offline provider. Agents tag their system prompt with
 * `[role:<name>]`, and the mock produces a plausible response for that role.
 * Same input → same output, so it is ideal for tests, demos and CI.
 */
export class MockProvider implements LLMProvider {
  readonly name = "mock";

  constructor(private readonly latencyMs = 0) {}

  async complete(req: CompletionRequest): Promise<string> {
    if (this.latencyMs) await new Promise((r) => setTimeout(r, this.latencyMs));
    const role = /\[role:([a-z-]+)\]/i.exec(req.system)?.[1]?.toLowerCase() ?? "assistant";
    switch (role) {
      case "planner":
        return this.plan(req.prompt);
      case "researcher":
        return this.research(req.prompt);
      case "writer":
        return this.write(req.prompt);
      default:
        return `OK: ${firstLine(req.prompt)}`;
    }
  }

  private plan(prompt: string): string {
    const goal = extract(prompt, "GOAL");
    const topic = topicOf(goal);
    const steps = [
      { id: 1, question: `Who is the target audience for ${topic}, and what do they need?` },
      { id: 2, question: `What are the strongest channels and formats to reach them for ${topic}?` },
      { id: 3, question: `What risks or constraints could block ${topic}, and how do we de-risk them?` },
    ];
    return JSON.stringify({ goal, steps });
  }

  private research(prompt: string): string {
    const q = extract(prompt, "QUESTION");
    const subject = topicOf(extract(prompt, "GOAL"));
    const lens = /audience/i.test(q)
      ? [`Define two primary personas for ${subject}, with budgets and buying triggers`, "Validate both with five short customer interviews", "Prioritise the persona with the shortest sales cycle"]
      : /channel|format/i.test(q)
        ? ["Short-form vertical video outperforms static posts for discovery", `Pair organic posting about ${subject} with a small paid retargeting budget`, "Use case-study carousels for consideration-stage buyers"]
        : ["Scope creep: fix deliverables and revision counts up front", "Capacity: template repeatable work before scaling sales", "Cash flow: take a 50% deposit on new projects"];
    const angle = /audience/i.test(q) ? "audience" : /channel|format/i.test(q) ? "channels" : "risks";
    return [`Findings (${angle}) for ${subject}:`, ...lens.map((l) => `- ${l}`)].join("\n");
  }

  private write(prompt: string): string {
    const goal = extract(prompt, "GOAL");
    const notes = prompt.split("NOTES:")[1]?.trim() ?? "";
    const bullets = notes
      .split("\n")
      .filter((l) => l.trim().startsWith("- "))
      .map((l) => l.trim());
    const sections = [
      ["Audience", bullets.slice(0, 3)],
      ["Go-to-market", bullets.slice(3, 6)],
      ["Risks & mitigations", bullets.slice(6, 9)],
    ] as const;
    const body = sections
      .filter(([, b]) => b.length)
      .map(([title, b]) => `## ${title}\n${b.join("\n")}`)
      .join("\n\n");
    return `# ${capitalise(goal)}\n\n${body}\n\n## Next step\n- Turn the top item in each section into a one-week experiment.`;
  }
}

function extract(prompt: string, label: string): string {
  const m = new RegExp(`${label}:\\s*(.+)`).exec(prompt);
  return (m?.[1] ?? prompt).trim();
}

function firstLine(s: string): string {
  return s.split("\n")[0]!.slice(0, 80);
}

/** "Launch plan for a London AI video studio" -> "a London AI video studio" */
function topicOf(text: string): string {
  return text
    .replace(/[?.!]+$/, "")
    .replace(/^(?:(?:a|an|the)\s+)?(?:[\w-]+\s+){0,2}?(?:plan|strategy|playbook|roadmap)\s+(?:for|to)\s+/i, "")
    .replace(/^(?:grow|launch|scale|market|build|start|open|promote)\s+/i, "")
    .trim();
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
