import express from "express";
import rateLimit from "express-rate-limit";
import ChatController from "../../../controllers/chat.controller";
import validateRequest from "../../../middlewares/validator";
import { isAuthorized } from "../../../middlewares/authentication";
import { sendMessageValidation } from "../../../models/validations/chat.validators";

const router = express.Router();

export const chatRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many chat requests from this IP address, please try again after a minute.",
  },
});

router.post(
  "/ai",
  isAuthorized(),
  chatRateLimiter,
  validateRequest(sendMessageValidation),
  ChatController.sendMessage
);

export default router;
