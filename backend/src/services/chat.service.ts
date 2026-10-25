import axios from "axios";
import crypto from "crypto";
import { Topic } from "@prisma/client";
import logger from "../core/config/logger";
import serverSettings from "../core/config/settings";
import { BadRequestError, InternalError } from "../core/api/ApiError";

export type PracticeLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

export interface ConversationMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatRequestInput {
  message: string;
  conversationContext?: ConversationMessage[];
  practiceLevel?: PracticeLevel;
  conversationType?: string;
  conversationId?: string;
  userId?: string;
}

export interface ChatResponseOutput {
  response: string;
  conversationId: string;
  timestamp: string;
  practiceLevel: PracticeLevel;
  conversationType: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const LEVEL_GUIDELINES: Record<PracticeLevel, string> = {
  A1: "Use very simple everyday expressions, present tense, and short sentences (5-10 words).",
  A2: "Use simple sentences about familiar routine topics and clear vocabulary.",
  B1: "Use clear standard input on familiar matters, encouraging the learner to explain opinions briefly.",
  B2: "Use natural, fluent language with moderate complexity and idiomatic expressions.",
  C1: "Use flexible, nuanced vocabulary and complex structures suitable for advanced learners.",
  C2: "Engage at near-native proficiency with subtle nuances, idioms, and sophisticated discourse.",
};

export default class ChatService {
  public static buildPromptFromTopic(topic: Topic, userContext?: { level?: string; name?: string }) {
    const header = `You are an English practice partner. Topic: ${topic.name} (Level: ${topic.englishLevel}).`;
    const instructions = `Have a short conversation with the user on this topic. Keep responses appropriate for the level.`;
    const seed =
      Array.isArray(topic.prompts) && topic.prompts.length > 0
        ? topic.prompts[0]
        : "Start a conversation on this topic.";
    const context = userContext?.name ? `User name: ${userContext.name}.` : "";
    return [header, instructions, context, `Prompt: ${seed}`].filter(Boolean).join("\n");
  }

  public static sanitizeText(input: string): string {
    return input
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .trim();
  }

  public static buildSystemPrompt(level: PracticeLevel = "B1", conversationType = "general"): string {
    const levelGuide = LEVEL_GUIDELINES[level] || LEVEL_GUIDELINES.B1;
    return [
      `You are Aurora, a supportive and interactive English conversation tutor.`,
      `Target CEFR Level: ${level}. ${levelGuide}`,
      `Conversation Mode: ${conversationType}.`,
      `Keep responses concise (2-4 sentences), gently correct major grammar mistakes when helpful, and end with an engaging follow-up question.`,
    ].join(" ");
  }

  public static async generateChatResponse(input: ChatRequestInput): Promise<ChatResponseOutput> {
    const sanitizedMessage = ChatService.sanitizeText(input.message || "");
    if (!sanitizedMessage) {
      throw new BadRequestError("Message content cannot be empty after sanitization");
    }

    const level: PracticeLevel = (input.practiceLevel?.toUpperCase() as PracticeLevel) || "B1";
    const conversationType = (input.conversationType || "general").toLowerCase();
    const conversationId = input.conversationId || crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const history: ConversationMessage[] = (input.conversationContext || [])
      .slice(-15)
      .filter((item) => item.role === "user" || item.role === "assistant")
      .map((item) => ({
        role: item.role,
        content: ChatService.sanitizeText(item.content),
      }))
      .filter((item) => item.content.length > 0);

    const messages: ConversationMessage[] = [
      { role: "system", content: ChatService.buildSystemPrompt(level, conversationType) },
      ...history,
      { role: "user", content: sanitizedMessage },
    ];

    const apiKey = serverSettings.openai?.apiKey || process.env.OPENAI_API_KEY;
    const model = serverSettings.openai?.model || process.env.OPENAI_MODEL || "gpt-3.5-turbo";

    if (!apiKey) {
      throw new InternalError("OpenAI API key is not configured");
    }

    try {
      logger.info("Sending OpenAI chat completion request", {
        userId: input.userId,
        conversationId,
        practiceLevel: level,
        conversationType,
        model,
      });

      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          messages,
          temperature: 0.7,
          max_tokens: 350,
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 15000,
        }
      );

      const aiText = response.data?.choices?.[0]?.message?.content;
      if (!aiText) {
        throw new InternalError("Empty response received from AI provider");
      }

      const usageData = response.data?.usage;
      logger.info("OpenAI chat completion succeeded", {
        userId: input.userId,
        conversationId,
        model,
        totalTokens: usageData?.total_tokens ?? 0,
      });

      return {
        response: ChatService.sanitizeText(aiText),
        conversationId,
        timestamp,
        practiceLevel: level,
        conversationType,
        ...(usageData
          ? {
              usage: {
                promptTokens: usageData.prompt_tokens ?? 0,
                completionTokens: usageData.completion_tokens ?? 0,
                totalTokens: usageData.total_tokens ?? 0,
              },
            }
          : {}),
      };
    } catch (err: any) {
      if (err instanceof BadRequestError || err instanceof InternalError) {
        throw err;
      }
      const status = err?.response?.status;
      logger.error("OpenAI chat request failed", {
        status,
        code: err?.code,
        providerError: err?.response?.data?.error?.type,
      });
      if (status === 429) {
        throw new InternalError("AI service rate limit or quota exceeded. Please try again shortly.");
      }
      if (status === 401) {
        throw new InternalError("AI provider authentication failed");
      }
      throw new InternalError("Failed to generate AI chat response");
    }
  }
}
