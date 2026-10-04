import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  Agent,
  createDefaultRelay,
  createMessage,
  MessageBus,
  MockProvider,
  parsePlan,
  Relay,
  type AgentContext,
  type Message,
} from "../src/index.js";

describe("MessageBus", () => {
  it("records history and notifies subscribers", () => {
    const bus = new MessageBus();
    const seen: string[] = [];
    const off = bus.subscribe((m) => seen.push(m.id));
    const a = createMessage({ from: "a", to: "b", kind: "task", content: "hi" });
    bus.publish(a);
    off();
    bus.publish(createMessage({ from: "b", to: "a", kind: "result", content: "yo" }));
    assert.equal(bus.size, 2);
    assert.deepEqual(seen, [a.id]);
    assert.equal(bus.history({ from: "b" }).length, 1);
  });
});

describe("parsePlan", () => {
  it("parses fenced JSON", () => {
    const steps = parsePlan('Sure!\n```json\n{"steps":[{"id":1,"question":"Why?"},{"id":2,"question":"How?"}]}\n```');
    assert.deepEqual(steps.map((s) => s.question), ["Why?", "How?"]);
  });
  it("falls back to numbered lines", () => {
    const steps = parsePlan("1. Who buys this?\n2) What does it cost?\nNot a question");
    assert.equal(steps.length, 2);
    assert.equal(steps[1]!.id, 2);
  });
});

describe("Relay with the default team", () => {
  it("runs planner → researcher → writer end to end", async () => {
    const result = await createDefaultRelay(new MockProvider()).run("Launch plan for a London AI video studio");
    assert.ok(result.output?.startsWith("# Launch plan for a London AI video studio"));
    assert.match(result.output!, /## Audience/);
    assert.match(result.output!, /## Risks & mitigations/);

    const tasksToResearcher = result.messages.filter((m) => m.to === "researcher" && m.kind === "task");
    const results = result.messages.filter((m) => m.from === "researcher" && m.kind === "result");
    assert.equal(tasksToResearcher.length, 3);
    assert.equal(results.length, 3);
    assert.ok(results.every((r) => tasksToResearcher.some((t) => t.id === r.replyTo)));
    assert.equal(result.messages.at(-1)!.kind, "final");
  });

  it("is deterministic with the mock provider", async () => {
    const a = await createDefaultRelay(new MockProvider()).run("Grow a Shoreditch barbershop");
    const b = await createDefaultRelay(new MockProvider()).run("Grow a Shoreditch barbershop");
    assert.equal(a.output, b.output);
  });
});

describe("Relay safety", () => {
  class PingPong extends Agent {
    readonly role = "loops forever";
    constructor(readonly name: string, private readonly peer: string) {
      super(new MockProvider());
    }
    async handle(msg: Message, _ctx: AgentContext): Promise<Message[]> {
      return [createMessage({ from: this.name, to: this.peer, kind: "task", content: msg.content })];
    }
  }

  it("enforces the hop limit", async () => {
    const relay = new Relay({ maxHops: 10 }).register(new PingPong("planner", "echo"), new PingPong("echo", "planner"));
    await assert.rejects(relay.run("loop"), /Hop limit of 10 exceeded/);
  });

  it("rejects duplicate agent names", () => {
    assert.throws(() => new Relay().register(new PingPong("x", "y"), new PingPong("x", "y")), /already registered/);
  });

  it("reports unknown recipients on the bus", async () => {
    const relay = new Relay().register(new PingPong("planner", "ghost"));
    const res = await relay.run("hello");
    assert.ok(res.messages.some((m) => m.from === "relay" && m.kind === "error"));
    assert.equal(res.output, null);
  });
});
