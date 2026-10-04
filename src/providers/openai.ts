import type { CompletionRequest, LLMProvider } from "./types.js";

interface ChatResponse {
  choices: { message: { content: string } }[];
}

/** Any OpenAI-compatible /chat/completions endpoint, using global fetch (Node 20+). */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly model = "gpt-4o-mini",
    private readonly baseUrl = "https://api.openai.com/v1",
  ) {
    this.name = `openai:${model}`;
  }

  static fromEnv(env: NodeJS.ProcessEnv = process.env): OpenAICompatibleProvider {
    const key = env.OPENAI_API_KEY;
    if (!key) throw new Error("OPENAI_API_KEY is not set (use --provider mock to run offline)");
    return new OpenAICompatibleProvider(key, env.AGENT_RELAY_MODEL ?? "gpt-4o-mini", (env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, ""));
  }

  async complete(req: CompletionRequest): Promise<string> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        temperature: req.temperature ?? 0.4,
        ...(req.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`LLM request failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as ChatResponse;
    return data.choices[0]?.message.content ?? "";
  }
}
