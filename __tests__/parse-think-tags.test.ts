/**
 * Tests for <think> tag parsing in chat messages.
 */

// Extract the parsing logic inline since it's a private function in ChatBubble
function parseThinkTags(content: string): { thinking: string | null; body: string } {
  const match = content.match(/<think>([\s\S]*?)<\/think>\s*/);
  if (match) {
    return {
      thinking: match[1].trim() || null,
      body: content.slice(match.index! + match[0].length).trim(),
    };
  }
  if (content.startsWith("<think>") && !content.includes("</think>")) {
    return {
      thinking: content.slice(7).trim() || null,
      body: "",
    };
  }
  return { thinking: null, body: content };
}

describe("parseThinkTags", () => {
  it("returns body only when no think tags", () => {
    const result = parseThinkTags("Hello, world!");
    expect(result.thinking).toBeNull();
    expect(result.body).toBe("Hello, world!");
  });

  it("extracts thinking content and body", () => {
    const result = parseThinkTags(
      "<think>I should check the weather API</think>\nThe weather in Miami is 78°F."
    );
    expect(result.thinking).toBe("I should check the weather API");
    expect(result.body).toBe("The weather in Miami is 78°F.");
  });

  it("handles empty think tags", () => {
    const result = parseThinkTags("<think></think>Here is the answer.");
    expect(result.thinking).toBeNull();
    expect(result.body).toBe("Here is the answer.");
  });

  it("handles multiline thinking", () => {
    const result = parseThinkTags(
      "<think>\nStep 1: Parse the request\nStep 2: Call the API\n</think>\nDone!"
    );
    expect(result.thinking).toBe("Step 1: Parse the request\nStep 2: Call the API");
    expect(result.body).toBe("Done!");
  });

  it("handles unclosed think tag (still streaming)", () => {
    const result = parseThinkTags("<think>I'm still thinking about");
    expect(result.thinking).toBe("I'm still thinking about");
    expect(result.body).toBe("");
  });

  it("handles unclosed think tag with no content yet", () => {
    const result = parseThinkTags("<think>");
    expect(result.thinking).toBeNull();
    expect(result.body).toBe("");
  });

  it("handles think tags with only whitespace", () => {
    const result = parseThinkTags("<think>   \n  </think>Answer here.");
    expect(result.thinking).toBeNull();
    expect(result.body).toBe("Answer here.");
  });
});
