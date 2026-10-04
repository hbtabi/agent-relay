import type { LLMProvider } from "../providers/types.js";
import type { Message } from "./message.js";

export interface AgentContext {
  /** The original user goal for this run. */
  goal: string;
  /** Read-only view of everything said so far. */
  history: readonly Message[];
}

export abstract class Agent {
  abstract readonly name: string;
  abstract readonly role: string;
  /** Emoji/glyph used by the CLI renderer. */
  readonly icon: string = "●";

  constructor(protected readonly llm: LLMProvider) {}

  /** React to an incoming message, returning zero or more outgoing messages. */
  abstract handle(msg: Message, ctx: AgentContext): Promise<Message[]>;
}
