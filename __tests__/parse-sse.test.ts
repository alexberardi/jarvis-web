/**
 * Tests for SSE chunk parsing.
 */

interface ChatStreamEvent {
  type: "status" | "delta" | "done" | "error";
  text?: string;
  message?: string;
  conversation_id?: string;
  full_text?: string;
}

// Extracted from lib/api.ts
function parseSSEChunk(text: string): ChatStreamEvent[] {
  const events: ChatStreamEvent[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("data: ")) continue;
    try {
      events.push(JSON.parse(trimmed.slice(6)) as ChatStreamEvent);
    } catch {
      // Incomplete JSON — skip
    }
  }
  return events;
}

describe("parseSSEChunk", () => {
  it("parses a single event", () => {
    const events = parseSSEChunk('data: {"type":"delta","text":"Hello"}');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("delta");
    expect(events[0].text).toBe("Hello");
  });

  it("parses multiple events", () => {
    const chunk = [
      'data: {"type":"status","message":"Processing..."}',
      'data: {"type":"delta","text":"Hi"}',
      'data: {"type":"done","full_text":"Hi there","conversation_id":"abc-123"}',
    ].join("\n");
    const events = parseSSEChunk(chunk);
    expect(events).toHaveLength(3);
    expect(events[0].type).toBe("status");
    expect(events[1].type).toBe("delta");
    expect(events[2].type).toBe("done");
    expect(events[2].conversation_id).toBe("abc-123");
  });

  it("ignores empty lines", () => {
    const chunk = '\n\ndata: {"type":"delta","text":"x"}\n\n';
    const events = parseSSEChunk(chunk);
    expect(events).toHaveLength(1);
  });

  it("ignores non-data lines", () => {
    const chunk = 'event: message\ndata: {"type":"delta","text":"x"}\nid: 1';
    const events = parseSSEChunk(chunk);
    expect(events).toHaveLength(1);
  });

  it("skips incomplete JSON", () => {
    const chunk = 'data: {"type":"delta","text":"incompl';
    const events = parseSSEChunk(chunk);
    expect(events).toHaveLength(0);
  });

  it("handles error events", () => {
    const events = parseSSEChunk('data: {"type":"error","message":"Something broke"}');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
    expect(events[0].message).toBe("Something broke");
  });
});
