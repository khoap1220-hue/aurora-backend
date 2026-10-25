import axios from "axios";
import { Request, Response } from "express";
import ChatController from "../../src/controllers/chat.controller";
import { InternalError } from "../../src/core/api/ApiError";
import serverSettings from "../../src/core/config/settings";
import ChatService, { ConversationMessage } from "../../src/services/chat.service";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("ChatService", () => {
  const originalOpenAiSettings = serverSettings.openai
    ? { ...serverSettings.openai }
    : undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.OPENAI_MODEL = "gpt-3.5-turbo";
    if (serverSettings.openai) {
      serverSettings.openai.apiKey = "test-openai-key";
      serverSettings.openai.model = "gpt-3.5-turbo";
    }
  });

  afterAll(() => {
    if (originalOpenAiSettings && serverSettings.openai) {
      serverSettings.openai.apiKey = originalOpenAiSettings.apiKey;
      serverSettings.openai.model = originalOpenAiSettings.model;
    }
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

  it("slices conversationContext to the last 15 entries before filtering empty entries", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: "Continuing conversation." } }],
      },
    } as any);

    const olderEntry: ConversationMessage = {
      role: "user",
      content: "older-entry-outside-window",
    };
    const recentEntries: ConversationMessage[] = Array.from({ length: 15 }, (_, idx) => {
      if (idx === 4) {
        return { role: "user", content: "   <script>alert(1)</script>   " };
      }
      return {
        role: idx % 2 === 0 ? "user" : "assistant",
        content: `window-entry-${idx + 1}`,
      };
    });

    await ChatService.generateChatResponse({
      message: "final-user-message",
      conversationContext: [olderEntry, ...recentEntries],
      practiceLevel: "B2",
      conversationType: "grammar",
    });

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const payload = mockedAxios.post.mock.calls[0][1] as {
      messages: ConversationMessage[];
    };
    expect(payload.messages[0].role).toBe("system");
    expect(payload.messages[0].content).toContain("Target CEFR Level: B2");
    expect(payload.messages.some((m) => m.content === "older-entry-outside-window")).toBe(false);
    // 1 system + 14 non-empty in-window entries + 1 final user message = 16 messages
    expect(payload.messages).toHaveLength(16);
    expect(payload.messages[payload.messages.length - 1]).toEqual({
      role: "user",
      content: "final-user-message",
    });
  });

  it("maps provider HTTP 429 responses to InternalError", async () => {
    mockedAxios.post.mockRejectedValueOnce({
      code: "ERR_BAD_REQUEST",
      response: {
        status: 429,
        data: { error: { type: "rate_limit_error" } },
      },
    });

    await expect(
      ChatService.generateChatResponse({
        message: "Test rate limit error",
      })
    ).rejects.toThrow(
      new InternalError("AI service rate limit or quota exceeded. Please try again shortly.")
    );
  });

  it("throws InternalError when OpenAI API key is missing from both settings and env", async () => {
    delete process.env.OPENAI_API_KEY;
    if (serverSettings.openai) {
      serverSettings.openai.apiKey = "";
    }

    await expect(
      ChatService.generateChatResponse({
        message: "Hello without API key",
      })
    ).rejects.toThrow(new InternalError("OpenAI API key is not configured"));
  });
});

describe("ChatController.sendMessage", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("overrides body userId with authenticated req.user.id and returns SuccessResponse", async () => {
    const mockResult = {
      response: "Great job!",
      conversationId: "11111111-2222-3333-4444-555555555555",
      timestamp: "2026-10-25T00:00:00.000Z",
      practiceLevel: "B1" as const,
      conversationType: "general",
    };
    const generateSpy = jest
      .spyOn(ChatService, "generateChatResponse")
      .mockResolvedValueOnce(mockResult);

    const req = {
      user: { id: "authenticated-user-id" },
      body: {
        message: "Practice greeting",
        practiceLevel: "B1",
        conversationType: "general",
        userId: "spoofed-body-user-id",
      },
    } as unknown as Request;

    const statusMock = jest.fn().mockReturnThis();
    const jsonMock = jest.fn().mockReturnThis();
    const res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;
    const next = jest.fn();

    await ChatController.sendMessage(req, res, next);

    expect(generateSpy).toHaveBeenCalledWith({
      message: "Practice greeting",
      practiceLevel: "B1",
      conversationType: "general",
      userId: "authenticated-user-id",
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Chat response generated successfully",
        data: mockResult,
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards service errors to next middleware", async () => {
    const serviceError = new InternalError("Failed to generate AI chat response");
    jest.spyOn(ChatService, "generateChatResponse").mockRejectedValueOnce(serviceError);

    const req = {
      user: { id: "authenticated-user-id" },
      body: { message: "Hello" },
    } as unknown as Request;
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as unknown as Response;
    const next = jest.fn();

    await ChatController.sendMessage(req, res, next);

    expect(next).toHaveBeenCalledWith(serviceError);
  });
});
