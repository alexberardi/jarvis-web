/**
 * Tests for ChatBubble component rendering.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatBubble } from "@/components/chat/ChatBubble";
import type { ChatMessage } from "@/lib/api";

function makeMessage(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "test-1",
    role: "assistant",
    content: "Hello!",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("ChatBubble", () => {
  it("renders user message", () => {
    render(<ChatBubble message={makeMessage({ role: "user", content: "Hi there" })} />);
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });

  it("renders assistant message", () => {
    render(<ChatBubble message={makeMessage({ content: "Weather is 72°F" })} />);
    expect(screen.getByText("Weather is 72°F")).toBeInTheDocument();
  });

  it("renders status message with spinner", () => {
    render(<ChatBubble message={makeMessage({ role: "status", content: "Processing..." })} />);
    expect(screen.getByText("Processing...")).toBeInTheDocument();
  });

  it("strips think tags and shows body", () => {
    render(
      <ChatBubble
        message={makeMessage({
          content: "<think>reasoning here</think>The answer is 42.",
        })}
      />
    );
    expect(screen.getByText("The answer is 42.")).toBeInTheDocument();
    expect(screen.queryByText("<think>")).not.toBeInTheDocument();
  });

  it("shows collapsible thought process", async () => {
    render(
      <ChatBubble
        message={makeMessage({
          content: "<think>I need to check the API</think>Here is the result.",
        })}
      />
    );
    // Thinking block should be collapsed
    expect(screen.getByText("Thought process")).toBeInTheDocument();
    expect(screen.queryByText("I need to check the API")).not.toBeInTheDocument();

    // Click to expand
    await userEvent.click(screen.getByText("Thought process"));
    expect(screen.getByText("I need to check the API")).toBeInTheDocument();
  });

  it("renders action buttons", () => {
    const onAction = jest.fn();
    render(
      <ChatBubble
        message={makeMessage({
          content: "Draft ready.",
          actions: [
            { button_text: "Send", button_action: "send_click", button_type: "primary" },
            { button_text: "Cancel", button_action: "cancel_click", button_type: "secondary" },
          ],
          actionContext: { command_name: "email", context: { draft: "hello" } },
        })}
        onAction={onAction}
      />
    );
    expect(screen.getByText("Send")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders action preview", () => {
    render(
      <ChatBubble
        message={makeMessage({
          content: "Here's your email draft.",
          actionPreview: "Subject: Hello\nBody: Test email",
        })}
      />
    );
    expect(screen.getByText(/Subject: Hello/)).toBeInTheDocument();
    expect(screen.getByText(/Body: Test email/)).toBeInTheDocument();
  });

  it("renders markdown content via ReactMarkdown", () => {
    render(
      <ChatBubble message={makeMessage({ content: "The **temperature** is 72°F" })} />
    );
    // ReactMarkdown is mocked — just verify content is passed through
    expect(screen.getByTestId("markdown")).toHaveTextContent("The **temperature** is 72°F");
  });
});
