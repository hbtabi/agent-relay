export interface CompletionRequest {
  system: string;
  prompt: string;
  temperature?: number;
  /** Ask the provider for a JSON response where supported. */
  json?: boolean;
}

export interface LLMProvider {
  readonly name: string;
  complete(req: CompletionRequest): Promise<string>;
}
