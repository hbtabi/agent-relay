import { Agent, type AgentContext } from "../core/agent.js";
import { createMessage, type Message } from "../core/message.js";

const SYSTEM = `[role:writer]
You are a writing agent. Turn research notes into a crisp Markdown brief with a title,
short sections using "## " headings, bullet points, and a final "Next step" section.`;

export class WriterAgent extends Agent {
  readonly name = "writer";
  readonly role = "Synthesises research into the final deliverable";
  override readonly icon = "✎";

  async handle(msg: Message, ctx: AgentContext): Promise<Message[]> {
    if (msg.kind !== "task") return [];
    const notes = String(msg.data?.notes ?? "");
    const brief = await this.llm.complete({
      system: SYSTEM,
      prompt: `GOAL: ${ctx.goal}\nNOTES:\n${notes}`,
      temperature: 0.6,
    });
    return [createMessage({ from: this.name, to: "user", kind: "final", content: brief.trim(), replyTo: msg.id })];
  }
}
