import { MockProvider } from "./mock.js";
import { OpenAICompatibleProvider } from "./openai.js";
import type { LLMProvider } from "./types.js";

export type { LLMProvider, CompletionRequest } from "./types.js";
export { MockProvider, OpenAICompatibleProvider };

export function createProvider(name: string, opts: { latencyMs?: number } = {}): LLMProvider {
  switch (name) {
    case "mock":
      return new MockProvider(opts.latencyMs);
    case "openai":
      return OpenAICompatibleProvider.fromEnv();
    default:
      throw new Error(`Unknown provider "${name}". Try "mock" or "openai".`);
  }
}
