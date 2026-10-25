import Joi from "joi";

const practiceLevels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const conversationTypes = ["general", "grammar", "vocabulary", "roleplay", "topic"] as const;

const contextMessageSchema = Joi.object({
  role: Joi.string().valid("user", "assistant").required(),
  content: Joi.string().trim().min(1).max(2000).required(),
});

export const sendMessageValidation = {
  body: Joi.object({
    message: Joi.string().trim().min(1).max(2000).required(),
    conversationContext: Joi.array().items(contextMessageSchema).max(20).default([]),
    practiceLevel: Joi.string()
      .uppercase()
      .valid(...practiceLevels)
      .default("B1"),
    conversationType: Joi.string()
      .lowercase()
      .valid(...conversationTypes)
      .default("general"),
    conversationId: Joi.string().uuid().optional(),
  }),
};
