import type { Message } from "./message.js";

export type Listener = (msg: Message) => void;

/**
 * An in-memory message bus. Every message is appended to an ordered log,
 * which doubles as a replayable trace of the whole run.
 */
export class MessageBus {
  private readonly log: Message[] = [];
  private readonly listeners = new Set<Listener>();

  publish(msg: Message): void {
    this.log.push(msg);
    for (const l of this.listeners) l(msg);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  history(filter?: Partial<Pick<Message, "from" | "to" | "kind">>): Message[] {
    if (!filter) return [...this.log];
    return this.log.filter((m) =>
      (Object.keys(filter) as (keyof typeof filter)[]).every((k) => m[k] === filter[k]),
    );
  }

  get size(): number {
    return this.log.length;
  }
}
