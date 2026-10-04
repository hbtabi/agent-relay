import { Agent, type AgentContext } from "../core/agent.js";
import { createMessage, type Message } from "../core/message.js";

const SYSTEM = `[role:researcher]
You are a research agent. Answer the question with 3-5 concise, practical bullet points
starting with "- ". No preamble beyond a one-line heading.`;

export class ResearcherAgent extends Agent {
  readonly name = "researcher";
  readonly role = "Answers one focused question at a time";
  override readonly icon = "◇";

  async handle(msg: Message, ctx: AgentContext): Promise<Message[]> {
    if (msg.kind !== "task") return [];
    const findings = await this.llm.complete({
      system: SYSTEM,
      prompt: `GOAL: ${ctx.goal}\nQUESTION: ${msg.content}`,
      temperature: 0.3,
    });
    return [createMessage({ from: this.name, to: msg.from, kind: "result", content: findings.trim(), replyTo: msg.id, data: msg.data })];
  }
}
