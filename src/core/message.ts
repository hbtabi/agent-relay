export type MessageKind = "task" | "result" | "note" | "final" | "error";

export interface Message {
  id: string;
  from: string;
  to: string;
  kind: MessageKind;
  content: string;
  /** Optional structured payload (e.g. a plan step, research notes). */
  data?: Record<string, unknown>;
  /** Id of the message this one replies to. */
  replyTo?: string;
  ts: number;
}

let counter = 0;

export function createMessage(m: Omit<Message, "id" | "ts"> & { ts?: number }): Message {
  counter += 1;
  return { id: `m${String(counter).padStart(3, "0")}`, ts: m.ts ?? Date.now(), ...m };
}

export function resetMessageIds(): void {
  counter = 0;
}
