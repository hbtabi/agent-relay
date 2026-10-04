import { Agent, type AgentContext } from "../core/agent.js";
import { createMessage, type Message } from "../core/message.js";

export interface PlanStep {
  id: number;
  question: string;
}

const SYSTEM = `[role:planner]
You are a planning agent. Break the user's goal into 2-5 focused research questions.
Respond ONLY with JSON: {"goal": string, "steps": [{"id": number, "question": string}]}`;

/** Parses a plan from model output, tolerating code fences and stray prose. */
export function parsePlan(raw: string): PlanStep[] {
  const json = /\{[\s\S]*\}/.exec(raw)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json) as { steps?: unknown };
      if (Array.isArray(parsed.steps)) {
        return parsed.steps
          .filter((s): s is PlanStep => typeof s === "object" && s !== null && typeof (s as PlanStep).question === "string")
          .map((s, i) => ({ id: Number(s.id) || i + 1, question: s.question.trim() }));
      }
    } catch {
      /* fall through to line parsing */
    }
  }
  // Fallback: numbered or bulleted lines.
  return raw
    .split("\n")
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").trim())
    .filter((l) => l.endsWith("?"))
    .map((question, i) => ({ id: i + 1, question }));
}

export class PlannerAgent extends Agent {
  readonly name = "planner";
  readonly role = "Breaks the goal into research questions and coordinates the run";
  override readonly icon = "◆";
  private pending = new Set<string>();
  private notes: string[] = [];

  async handle(msg: Message, ctx: AgentContext): Promise<Message[]> {
    if (msg.kind === "task" && msg.from === "user") {
      const raw = await this.llm.complete({ system: SYSTEM, prompt: `GOAL: ${ctx.goal}`, json: true, temperature: 0.2 });
      const steps = parsePlan(raw);
      if (steps.length === 0) {
        return [createMessage({ from: this.name, to: "user", kind: "error", content: "Planner produced no steps." })];
      }
      const plan = createMessage({
        from: this.name,
        to: "user",
        kind: "note",
        content: `Plan with ${steps.length} steps`,
        data: { steps },
      });
      const tasks = steps.map((s) =>
        createMessage({ from: this.name, to: "researcher", kind: "task", content: s.question, data: { step: s.id }, replyTo: msg.id }),
      );
      tasks.forEach((t) => this.pending.add(t.id));
      return [plan, ...tasks];
    }

    if (msg.kind === "result" && msg.from === "researcher" && msg.replyTo) {
      this.pending.delete(msg.replyTo);
      this.notes.push(msg.content);
      if (this.pending.size > 0) return [];
      const out = createMessage({
        from: this.name,
        to: "writer",
        kind: "task",
        content: "All research is in. Write the brief.",
        data: { notes: this.notes.join("\n\n") },
      });
      this.notes = [];
      return [out];
    }
    return [];
  }
}
