import axios from "axios";
import ChatService from "../../src/services/chat.service";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("ChatService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_MODEL = "gpt-3.5-turbo";
  });

  it("builds a system prompt tailored to the requested CEFR level", () => {
    const prompt = ChatService.buildSystemPrompt("C1", "roleplay");
    expect(prompt).toContain("Target CEFR Level: C1");
    expect(prompt).toContain("Conversation Mode: roleplay");
  });

  it("sanitizes script tags and control characters from user input", () => {
    const dirty = "Hello <script>alert(1)</script> world\u0000!";
    expect(ChatService.sanitizeText(dirty)).toBe("Hello  world!");
  });

  it("generates a chat response via OpenAI completions endpoint", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: "Hello! Let's practice English together." } }],
        usage: { prompt_tokens: 25, completion_tokens: 10, total_tokens: 35 },
      },
    } as any);

    const res = await ChatService.generateChatResponse({
      message: "Hello, I want to practice English conversation",
      conversationContext: [],
      practiceLevel: "B1",
      conversationType: "general",
    });

    expect(res.response).toBe("Hello! Let's practice English together.");
    expect(res.practiceLevel).toBe("B1");
    expect(res.conversationId).toBeDefined();
    expect(res.timestamp).toBeDefined();
    expect(res.usage?.totalTokens).toBe(35);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
  });
});
