import { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middlewares/authentication';
import { AchievementService } from '../services/achievement.service';
import { BadgeService } from '../services/badge.service';
import { SEEDED_ACHIEVEMENTS } from '../models/interfaces/achievement.interfaces';
import { BadRequestError, NotFoundError, UnauthorizedError } from '../core/api/ApiError';
import logger from '../core/config/logger';

export class AchievementController {
  public static async getUserAchievements(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('Unauthorized - User not authenticated');
      }

      const data = await AchievementService.getUserAchievementsOverview(req.user.id);
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      if (error instanceof UnauthorizedError) {
        return res.status(401).json({ success: false, message: error.message });
      }
      logger.error('Error in AchievementController.getUserAchievements:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  public static async getCatalog(_req: Request, res: Response) {
    try {
      const data = AchievementService.getCatalogByCategory();
      return res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error in AchievementController.getCatalog:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  public static async checkAchievements(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('Unauthorized - User not authenticated');
      }

      const newlyEarned = await AchievementService.checkAndAwardAchievements(
        req.user.id,
        {},
        req.user.email ? { email: req.user.email, firstName: req.user.firstName } : undefined
      );

      return res.status(200).json({
        success: true,
        data: {
          newlyEarned,
          count: newlyEarned.length,
        },
      });
    } catch (error: any) {
      if (error instanceof UnauthorizedError) {
        return res.status(401).json({ success: false, message: error.message });
      }
      logger.error('Error in AchievementController.checkAchievements:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  public static async getLeaderboard(req: Request, res: Response) {
    try {
      const rawLimit = Number(req.query.limit ?? 10);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.trunc(rawLimit)), 100) : 10;
      const leaderboard = await AchievementService.getAchievementLeaderboard(limit);
      return res.status(200).json({
        success: true,
        data: leaderboard,
      });
    } catch (error) {
      logger.error('Error in AchievementController.getLeaderboard:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  public static async getBadgeCertificate(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('Unauthorized - User not authenticated');
      }

      const { achievementId } = req.params;
      if (!achievementId) {
        throw new BadRequestError('achievementId parameter is required');
      }

      const earnedRecords = await AchievementService.getEarnedRecords(req.user.id);
      const earned = earnedRecords.find((r) => r.achievementId === achievementId);
      if (!earned) {
        throw new NotFoundError('Achievement badge has not been earned yet');
      }

      const recipientName =
        [req.user.firstName, req.user.lastName].filter(Boolean).join(' ') || 'Aurora Learner';

      const certificate = BadgeService.generateCertificate(
        req.user.id,
        recipientName,
        achievementId,
        earned.earnedAt
      );
      if (!certificate) {
        throw new NotFoundError('Achievement definition not found');
      }

      return res.status(200).json({
        success: true,
        data: certificate,
      });
    } catch (error: any) {
      if (error instanceof UnauthorizedError) {
        return res.status(401).json({ success: false, message: error.message });
      }
      if (error instanceof BadRequestError) {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({ success: false, message: error.message });
      }
      logger.error('Error in AchievementController.getBadgeCertificate:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  public static async shareBadge(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.user?.id) {
        throw new UnauthorizedError('Unauthorized - User not authenticated');
      }

      const { achievementId } = req.params;
      const achievement = SEEDED_ACHIEVEMENTS.find((a) => a.id === achievementId);
      if (!achievement) {
        throw new NotFoundError('Achievement not found');
      }

      const earnedRecords = await AchievementService.getEarnedRecords(req.user.id);
      const earned = earnedRecords.find((r) => r.achievementId === achievementId);
      if (!earned) {
        throw new BadRequestError('Cannot share an unearned achievement badge');
      }

      const payload = BadgeService.buildSharePayload(req.user.id, achievement, earned.earnedAt);
      return res.status(200).json({
        success: true,
        data: payload,
      });
    } catch (error: any) {
      if (error instanceof UnauthorizedError) {
        return res.status(401).json({ success: false, message: error.message });
      }
      if (error instanceof BadRequestError) {
        return res.status(400).json({ success: false, message: error.message });
      }
      if (error instanceof NotFoundError) {
        return res.status(404).json({ success: false, message: error.message });
      }
      logger.error('Error in AchievementController.shareBadge:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
}
