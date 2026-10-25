import { prisma } from '../lib/prisma';
import logger from '../core/config/logger';
import {
  AchievementCategory,
  AchievementDefinition,
  SEEDED_ACHIEVEMENTS,
  UserAchievementRecord,
  UserProgressSnapshot,
} from '../models/interfaces/achievement.interfaces';
import { BadgeService } from './badge.service';

// In-memory store fallback when Prisma migrations for UserAchievement have not yet run
const memoryUserAchievements = new Map<string, Map<string, UserAchievementRecord>>();

export class AchievementService {
  public static getCatalogDefinitions(): AchievementDefinition[] {
    return SEEDED_ACHIEVEMENTS.filter((a) => a.isActive);
  }

  public static getCatalogByCategory() {
    const categories: Record<
      AchievementCategory,
      Array<{
        id: string;
        name: string;
        description: string;
        requirement: string;
        xpBonus: number;
        rarity: string;
        badgeUrl: string;
      }>
    > = {
      progress: [],
      streak: [],
      mastery: [],
      special: [],
    };

    for (const ach of AchievementService.getCatalogDefinitions()) {
      categories[ach.category].push({
        id: ach.id,
        name: ach.name,
        description: ach.description,
        requirement: ach.requirementText,
        xpBonus: ach.xpBonus,
        rarity: ach.rarity,
        badgeUrl: ach.badgeUrl,
      });
    }

    return { categories };
  }

  public static computeRequirementProgress(
    achievement: AchievementDefinition,
    snapshot: UserProgressSnapshot
  ): number {
    switch (achievement.requirementType) {
      case 'questions_completed':
        return Math.max(0, snapshot.questionsCompleted);
      case 'xp_total':
        return Math.max(0, snapshot.totalXP);
      case 'streak_days':
        return Math.max(0, snapshot.currentStreak, snapshot.longestStreak);
      case 'consecutive_correct':
        return Math.max(0, snapshot.consecutiveCorrect ?? 0);
      case 'speed_bonus_count':
        return Math.max(0, snapshot.speedBonusCount ?? 0);
      case 'levels_completed':
        return Math.max(0, snapshot.levelsCompleted ?? 0);
      case 'grammar_questions':
        return Math.max(0, snapshot.grammarQuestions ?? 0);
      case 'vocabulary_questions':
        return Math.max(0, snapshot.vocabularyQuestions ?? 0);
      case 'early_adopter':
        return snapshot.isEarlyAdopter ? 1 : 0;
      case 'weekend_lessons':
        return Math.max(0, snapshot.weekendLessons ?? 0);
      case 'night_owl_lessons':
        return Math.max(0, snapshot.nightOwlLessons ?? 0);
      case 'referrals_completed':
        return Math.max(0, snapshot.referralsCompleted ?? 0);
      default:
        return 0;
    }
  }

  public static async getUserSnapshot(
    userId: string,
    overrides: Partial<UserProgressSnapshot> = {}
  ): Promise<UserProgressSnapshot> {
    let totalXP = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let questionsCompleted = 0;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalXP: true,
          currentStreak: true,
          longestStreak: true,
        },
      });
      if (user) {
        totalXP = user.totalXP ?? 0;
        currentStreak = user.currentStreak ?? 0;
        longestStreak = user.longestStreak ?? 0;
      }
    } catch (err) {
      logger.debug('AchievementService.getUserSnapshot user lookup fallback:', err);
    }

    try {
      const count = await (prisma as any).userQuestionXP?.count?.({
        where: { userId },
      });
      if (typeof count === 'number') {
        questionsCompleted = count;
      }
    } catch {
      // fallback if userQuestionXP table is absent
    }

    return {
      userId,
      totalXP: overrides.totalXP ?? totalXP,
      currentStreak: overrides.currentStreak ?? currentStreak,
      longestStreak: overrides.longestStreak ?? longestStreak,
      questionsCompleted: overrides.questionsCompleted ?? questionsCompleted,
      consecutiveCorrect: overrides.consecutiveCorrect,
      speedBonusCount: overrides.speedBonusCount,
      levelsCompleted: overrides.levelsCompleted,
      grammarQuestions: overrides.grammarQuestions,
      vocabularyQuestions: overrides.vocabularyQuestions,
      isEarlyAdopter: overrides.isEarlyAdopter,
      weekendLessons: overrides.weekendLessons,
      nightOwlLessons: overrides.nightOwlLessons,
      referralsCompleted: overrides.referralsCompleted,
    };
  }

  public static async getEarnedRecords(userId: string): Promise<UserAchievementRecord[]> {
    const userMap = memoryUserAchievements.get(userId);
    const memoryRecords = userMap ? Array.from(userMap.values()) : [];

    try {
      const dbRecords = await (prisma as any).userAchievement?.findMany?.({
        where: { userId },
      });
      if (Array.isArray(dbRecords) && dbRecords.length > 0) {
        const merged = new Map<string, UserAchievementRecord>();
        for (const r of memoryRecords) merged.set(r.achievementId, r);
        for (const r of dbRecords) {
          merged.set(r.achievementId, {
            id: r.id,
            userId: r.userId,
            achievementId: r.achievementId,
            earnedAt: r.earnedAt ? new Date(r.earnedAt) : new Date(),
            progressValue: r.progressValue ?? 0,
            isNotified: Boolean(r.isNotified),
          });
        }
        return Array.from(merged.values());
      }
    } catch {
      // Fallback to in-memory records when table is not migrated yet
    }

    return memoryRecords;
  }

  private static async persistEarnedAchievement(
    userId: string,
    achievement: AchievementDefinition,
    progressValue: number
  ): Promise<UserAchievementRecord> {
    let userMap = memoryUserAchievements.get(userId);
    if (!userMap) {
      userMap = new Map<string, UserAchievementRecord>();
      memoryUserAchievements.set(userId, userMap);
    }

    const existing = userMap.get(achievement.id);
    if (existing) {
      return existing;
    }

    const record: UserAchievementRecord = {
      id: `ua_${userId.slice(0, 8)}_${achievement.id}`,
      userId,
      achievementId: achievement.id,
      earnedAt: new Date(),
      progressValue,
      isNotified: false,
    };

    userMap.set(achievement.id, record);

    try {
      await (prisma as any).userAchievement?.upsert?.({
        where: {
          userId_achievementId: {
            userId,
            achievementId: achievement.id,
          },
        },
        update: {
          progressValue,
        },
        create: {
          userId,
          achievementId: achievement.id,
          progressValue,
          isNotified: false,
        },
      });
    } catch {
      // Ignore if table not migrated yet
    }

    if (achievement.xpBonus > 0) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: {
            totalXP: { increment: achievement.xpBonus },
          },
        });
      } catch {
        // Ignore in unit tests or when user record is mocked
      }
    }

    return record;
  }

  public static async checkAndAwardAchievements(
    userId: string,
    overrides: Partial<UserProgressSnapshot> = {},
    notifyEmail?: { email: string; firstName?: string }
  ): Promise<AchievementDefinition[]> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('Valid userId is required');
    }

    const snapshot = await AchievementService.getUserSnapshot(userId, overrides);
    const existingRecords = await AchievementService.getEarnedRecords(userId);
    const earnedSet = new Set(existingRecords.map((r) => r.achievementId));

    const newlyAwarded: AchievementDefinition[] = [];

    for (const achievement of AchievementService.getCatalogDefinitions()) {
      if (earnedSet.has(achievement.id)) {
        continue;
      }

      const currentProgress = AchievementService.computeRequirementProgress(achievement, snapshot);
      if (currentProgress >= achievement.requirementValue) {
        const record = await AchievementService.persistEarnedAchievement(
          userId,
          achievement,
          currentProgress
        );
        earnedSet.add(achievement.id);
        newlyAwarded.push(achievement);

        if (notifyEmail?.email) {
          const sent = await BadgeService.sendAchievementNotification(
            notifyEmail.email,
            notifyEmail.firstName,
            achievement
          );
          if (sent) {
            record.isNotified = true;
          }
        }
      }
    }

    return newlyAwarded;
  }

  public static async getUserAchievementsOverview(
    userId: string,
    overrides: Partial<UserProgressSnapshot> = {}
  ) {
    // Evaluate retroactive milestones first
    await AchievementService.checkAndAwardAchievements(userId, overrides);

    const snapshot = await AchievementService.getUserSnapshot(userId, overrides);
    const earnedRecords = await AchievementService.getEarnedRecords(userId);
    const earnedById = new Map(earnedRecords.map((r) => [r.achievementId, r]));

    const earned: Array<{
      id: string;
      name: string;
      description: string;
      category: AchievementCategory;
      earnedAt: string;
      xpBonus: number;
      badgeUrl: string;
      rarity: string;
    }> = [];

    const inProgress: Array<{
      id: string;
      name: string;
      description: string;
      category: AchievementCategory;
      currentProgress: number;
      requirement: number;
      progressPercentage: number;
    }> = [];

    const categoryCounts: Record<AchievementCategory, number> = {
      progress: 0,
      streak: 0,
      mastery: 0,
      special: 0,
    };

    let totalBonusXP = 0;

    for (const achievement of AchievementService.getCatalogDefinitions()) {
      const earnedRecord = earnedById.get(achievement.id);
      if (earnedRecord) {
        earned.push({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          category: achievement.category,
          earnedAt: earnedRecord.earnedAt.toISOString(),
          xpBonus: achievement.xpBonus,
          badgeUrl: achievement.badgeUrl,
          rarity: achievement.rarity,
        });
        totalBonusXP += achievement.xpBonus;
        categoryCounts[achievement.category] += 1;
      } else {
        const currentProgress = AchievementService.computeRequirementProgress(
          achievement,
          snapshot
        );
        const progressPercentage = Math.min(
          99,
          Math.floor((currentProgress / Math.max(1, achievement.requirementValue)) * 100)
        );
        inProgress.push({
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          category: achievement.category,
          currentProgress,
          requirement: achievement.requirementValue,
          progressPercentage,
        });
      }
    }

    let favoriteCategory: AchievementCategory | null = null;
    let maxCatCount = 0;
    for (const [cat, count] of Object.entries(categoryCounts) as Array<
      [AchievementCategory, number]
    >) {
      if (count > maxCatCount) {
        maxCatCount = count;
        favoriteCategory = cat;
      }
    }

    return {
      earned,
      inProgress,
      summary: {
        totalEarned: earned.length,
        totalBonusXP,
        favoriteCategory,
      },
    };
  }

  public static async getAchievementLeaderboard(limit = 10) {
    const entries: Array<{
      userId: string;
      totalEarned: number;
      totalBonusXP: number;
    }> = [];

    for (const [userId, recordsMap] of memoryUserAchievements.entries()) {
      let bonus = 0;
      for (const rec of recordsMap.values()) {
        const def = SEEDED_ACHIEVEMENTS.find((a) => a.id === rec.achievementId);
        if (def) bonus += def.xpBonus;
      }
      entries.push({
        userId,
        totalEarned: recordsMap.size,
        totalBonusXP: bonus,
      });
    }

    entries.sort((a, b) => b.totalEarned - a.totalEarned || b.totalBonusXP - a.totalBonusXP);
    return entries.slice(0, Math.max(1, Math.min(100, limit)));
  }

  public static clearMemoryStoreForTests(): void {
    memoryUserAchievements.clear();
  }
}
