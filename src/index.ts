export { Agent, type AgentContext } from "./core/agent.js";
export { MessageBus } from "./core/bus.js";
export { createMessage, type Message, type MessageKind } from "./core/message.js";
export { Relay, type RelayOptions, type RunResult } from "./relay.js";
export { PlannerAgent, parsePlan, type PlanStep } from "./agents/planner.js";
export { ResearcherAgent } from "./agents/researcher.js";
export { WriterAgent } from "./agents/writer.js";
export { createProvider, MockProvider, OpenAICompatibleProvider, type LLMProvider } from "./providers/index.js";

import { PlannerAgent } from "./agents/planner.js";
import { ResearcherAgent } from "./agents/researcher.js";
import { WriterAgent } from "./agents/writer.js";
import type { LLMProvider } from "./providers/types.js";
import { Relay } from "./relay.js";

/** Convenience: a relay pre-wired with the planner → researcher → writer team. */
export function createDefaultRelay(llm: LLMProvider, maxHops = 50): Relay {
  return new Relay({ maxHops }).register(new PlannerAgent(llm), new ResearcherAgent(llm), new WriterAgent(llm));
}
