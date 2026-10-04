import type { Agent } from "./core/agent.js";
import { MessageBus } from "./core/bus.js";
import { createMessage, type Message } from "./core/message.js";

export interface RelayOptions {
  /** Hard cap on delivered messages, protecting against agent ping-pong loops. */
  maxHops?: number;
  bus?: MessageBus;
}

export interface RunResult {
  goal: string;
  output: string | null;
  messages: Message[];
  hops: number;
  durationMs: number;
}

/**
 * Routes messages between registered agents until a `final` message
 * reaches the user, the queue drains, or the hop limit is hit.
 */
export class Relay {
  readonly bus: MessageBus;
  private readonly agents = new Map<string, Agent>();
  private readonly maxHops: number;

  constructor(opts: RelayOptions = {}) {
    this.bus = opts.bus ?? new MessageBus();
    this.maxHops = opts.maxHops ?? 50;
  }

  register(...agents: Agent[]): this {
    for (const a of agents) {
      if (this.agents.has(a.name)) throw new Error(`Agent "${a.name}" is already registered`);
      this.agents.set(a.name, a);
    }
    return this;
  }

  get roster(): Agent[] {
    return [...this.agents.values()];
  }

  async run(goal: string, entry = "planner"): Promise<RunResult> {
    if (!this.agents.has(entry)) throw new Error(`Entry agent "${entry}" is not registered`);
    const started = performance.now();
    const queue: Message[] = [createMessage({ from: "user", to: entry, kind: "task", content: goal })];
    let hops = 0;
    let output: string | null = null;

    while (queue.length > 0) {
      const msg = queue.shift()!;
      this.bus.publish(msg);

      if (msg.to === "user") {
        if (msg.kind === "final") output = msg.content;
        if (msg.kind === "error") throw new Error(msg.content);
        continue;
      }
      if (++hops > this.maxHops) {
        throw new Error(`Hop limit of ${this.maxHops} exceeded - possible agent loop`);
      }
      const agent = this.agents.get(msg.to);
      if (!agent) {
        this.bus.publish(createMessage({ from: "relay", to: msg.from, kind: "error", content: `No agent named "${msg.to}"`, replyTo: msg.id }));
        continue;
      }
      const replies = await agent.handle(msg, { goal, history: this.bus.history() });
      queue.push(...replies);
    }

    return { goal, output, messages: this.bus.history(), hops, durationMs: performance.now() - started };
  }
}
