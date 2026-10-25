import { Request, Response } from "express";
import { SuccessResponse } from "../core/api/ApiResponse";
import ChatService from "../services/chat.service";
import asyncHandler from "../middlewares/async";

export default class ChatController {
  static sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user?.id;
    const result = await ChatService.generateChatResponse({
      ...req.body,
      userId,
    });
    return new SuccessResponse("Chat response generated successfully", result).send(res);
  });
}
