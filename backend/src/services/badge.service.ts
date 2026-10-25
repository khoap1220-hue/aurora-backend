import EmailNotifier from '../utils/service/emailNotifier';
import logger from '../core/config/logger';
import {
  AchievementDefinition,
  SEEDED_ACHIEVEMENTS,
  UserAchievementRecord,
} from '../models/interfaces/achievement.interfaces';

export interface BadgeDisplayMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  rarity: string;
  badgeUrl: string;
  xpBonus: number;
  earnedAt?: string;
}

export interface AchievementCertificate {
  certificateId: string;
  userId: string;
  recipientName: string;
  achievementId: string;
  achievementName: string;
  description: string;
  category: string;
  rarity: string;
  xpBonus: number;
  badgeUrl: string;
  issuedAt: string;
  verificationCode: string;
}

export class BadgeService {
  public static getBadgeMetadata(
    achievement: AchievementDefinition,
    earnedRecord?: UserAchievementRecord
  ): BadgeDisplayMetadata {
    return {
      id: achievement.id,
      name: achievement.name,
      description: achievement.description,
      category: achievement.category,
      rarity: achievement.rarity,
      badgeUrl: achievement.badgeUrl,
      xpBonus: achievement.xpBonus,
      earnedAt: earnedRecord ? earnedRecord.earnedAt.toISOString() : undefined,
    };
  }

  public static generateCertificate(
    userId: string,
    recipientName: string,
    achievementId: string,
    earnedAt: Date = new Date()
  ): AchievementCertificate | null {
    const achievement = SEEDED_ACHIEVEMENTS.find((a) => a.id === achievementId);
    if (!achievement) {
      return null;
    }

    const issuedIso = earnedAt.toISOString();
    const verificationCode = `AURORA-${achievement.id.toUpperCase()}-${userId.slice(0, 8).toUpperCase()}`;

    return {
      certificateId: `cert_${achievement.id}_${userId.slice(0, 8)}`,
      userId,
      recipientName: recipientName || 'Aurora Learner',
      achievementId: achievement.id,
      achievementName: achievement.name,
      description: achievement.description,
      category: achievement.category,
      rarity: achievement.rarity,
      xpBonus: achievement.xpBonus,
      badgeUrl: achievement.badgeUrl,
      issuedAt: issuedIso,
      verificationCode,
    };
  }

  public static buildSharePayload(
    userId: string,
    achievement: AchievementDefinition,
    earnedAt: Date = new Date()
  ) {
    return {
      title: `I earned the "${achievement.name}" badge on Aurora!`,
      summary: `${achievement.description} (+${achievement.xpBonus} XP Bonus)`,
      badgeUrl: achievement.badgeUrl,
      rarity: achievement.rarity,
      category: achievement.category,
      earnedAt: earnedAt.toISOString(),
      shareUrl: `https://aurora.app/achievements/share/${userId}/${achievement.id}`,
    };
  }

  public static formatCelebrationEmail(achievement: AchievementDefinition): string {
    return (
      `Congratulations! You've earned the "${achievement.name}" badge!\n` +
      `${achievement.description} - keep up the amazing progress!\n` +
      `Bonus: +${achievement.xpBonus} XP added to your account`
    );
  }

  public static async sendAchievementNotification(
    email: string,
    firstName: string | undefined,
    achievement: AchievementDefinition
  ): Promise<boolean> {
    if (!email) return false;
    try {
      const body = BadgeService.formatCelebrationEmail(achievement);
      await EmailNotifier.sendMotivationalEmail(email, firstName, body);
      return true;
    } catch (error) {
      logger.warn(`Failed to send achievement email for ${achievement.id}:`, error);
      return false;
    }
  }
}
