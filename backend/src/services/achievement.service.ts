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

const memoryUserAchievements = new Map<string, Map<string, UserAchievementRecord>>();
const EARLY_ADOPTER_CUTOFF = new Date('2025-06-01T00:00:00.000Z');

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
    let isEarlyAdopter = false;
    let weekendLessons = 0;
    let nightOwlLessons = 0;
    let grammarQuestions = 0;
    let vocabularyQuestions = 0;
    let levelsCompleted = 0;
    let consecutiveCorrect = 0;
    let speedBonusCount = 0;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          totalXP: true,
          currentStreak: true,
          longestStreak: true,
          createdAt: true,
        },
      });
      if (user) {
        totalXP = user.totalXP ?? 0;
        currentStreak = user.currentStreak ?? 0;
        longestStreak = user.longestStreak ?? 0;
        if (user.createdAt && new Date(user.createdAt) <= EARLY_ADOPTER_CUTOFF) {
          isEarlyAdopter = true;
        }
      }
    } catch (err) {
      logger.debug('AchievementService.getUserSnapshot user lookup fallback:', err);
    }

    try {
      const xpRows = await prisma.userQuestionXP.findMany({
        where: { userId },
        include: {
          question: {
            select: {
              type: true,
              difficulty: true,
            },
          },
        },
        orderBy: { awardedAt: 'asc' },
      });

      if (Array.isArray(xpRows)) {
        questionsCompleted = xpRows.length;
        // consecutiveCorrect needs an ordered attempt log that includes wrong answers.
        // Leave it at 0 until that data source exists.
        const levelCounts = new Map<string, number>();

        for (const row of xpRows) {
          const awardedAt = row.awardedAt ? new Date(row.awardedAt) : null;
          if (awardedAt) {
            const day = awardedAt.getUTCDay();
            if (day === 0 || day === 6) weekendLessons += 1;
            if (awardedAt.getUTCHours() >= 22) nightOwlLessons += 1;
          }
          if ((row.xpAwarded ?? 0) > 10) {
            speedBonusCount += 1;
          }
          const qType = String(row.question?.type ?? '');
          if (qType === 'SENTENCE_BUILDER' || qType === 'FILL_IN_BLANKS') {
            grammarQuestions += 1;
          } else if (qType === 'MULTIPLE_CHOICE' || qType === 'IDIOM_CHALLENGE') {
            vocabularyQuestions += 1;
          }
          const diff = String(row.question?.difficulty ?? '');
          if (diff) {
            levelCounts.set(diff, (levelCounts.get(diff) ?? 0) + 1);
          }
        }
        levelsCompleted = Array.from(levelCounts.values()).filter((c) => c >= 50).length;
      }
    } catch {
      // Fallback when question relation is unavailable
    }

    return {
      userId,
      totalXP: overrides.totalXP ?? totalXP,
      currentStreak: overrides.currentStreak ?? currentStreak,
      longestStreak: overrides.longestStreak ?? longestStreak,
      questionsCompleted: overrides.questionsCompleted ?? questionsCompleted,
      consecutiveCorrect: overrides.consecutiveCorrect ?? consecutiveCorrect,
      speedBonusCount: overrides.speedBonusCount ?? speedBonusCount,
      levelsCompleted: overrides.levelsCompleted ?? levelsCompleted,
      grammarQuestions: overrides.grammarQuestions ?? grammarQuestions,
      vocabularyQuestions: overrides.vocabularyQuestions ?? vocabularyQuestions,
      isEarlyAdopter: overrides.isEarlyAdopter ?? isEarlyAdopter,
      weekendLessons: overrides.weekendLessons ?? weekendLessons,
      nightOwlLessons: overrides.nightOwlLessons ?? nightOwlLessons,
      referralsCompleted: overrides.referralsCompleted ?? 0,
    };
  }

  public static async getEarnedRecords(userId: string): Promise<UserAchievementRecord[]> {
    const userMap = memoryUserAchievements.get(userId);
    const memoryRecords = userMap ? Array.from(userMap.values()) : [];

    try {
      const dbRecords = await prisma.userAchievement.findMany({
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
  ): Promise<{ record: UserAchievementRecord; created: boolean }> {
    let userMap = memoryUserAchievements.get(userId);
    if (!userMap) {
      userMap = new Map<string, UserAchievementRecord>();
      memoryUserAchievements.set(userId, userMap);
    }

    const existing = userMap.get(achievement.id);
    if (existing) {
      return { record: existing, created: false };
    }

    const record: UserAchievementRecord = {
      id: `ua_${userId.slice(0, 8)}_${achievement.id}`,
      userId,
      achievementId: achievement.id,
      earnedAt: new Date(),
      progressValue,
      isNotified: false,
    };

    try {
      await prisma.$transaction(async (tx) => {
        await tx.achievement.upsert({
          where: { id: achievement.id },
          update: {
            name: achievement.name,
            description: achievement.description,
            category: achievement.category,
            requirementType: achievement.requirementType,
            requirementValue: achievement.requirementValue,
            xpBonus: achievement.xpBonus,
            badgeUrl: achievement.badgeUrl,
            rarity: achievement.rarity,
            isActive: achievement.isActive,
          },
          create: {
            id: achievement.id,
            name: achievement.name,
            description: achievement.description,
            category: achievement.category,
            requirementType: achievement.requirementType,
            requirementValue: achievement.requirementValue,
            xpBonus: achievement.xpBonus,
            badgeUrl: achievement.badgeUrl,
            rarity: achievement.rarity,
            isActive: achievement.isActive,
          },
        });

        await tx.userAchievement.create({
          data: {
            userId,
            achievementId: achievement.id,
            progressValue,
            isNotified: false,
          },
        });

        if (achievement.xpBonus > 0) {
          await tx.user.update({
            where: { id: userId },
            data: {
              totalXP: { increment: achievement.xpBonus },
            },
          });
        }
      });

      userMap.set(achievement.id, record);
      return { record, created: true };
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'P2002') {
        const persisted = await prisma.userAchievement.findUnique({
          where: {
            userId_achievementId: {
              userId,
              achievementId: achievement.id,
            },
          },
        });
        const existingRecord: UserAchievementRecord = persisted
          ? {
              id: persisted.id,
              userId: persisted.userId,
              achievementId: persisted.achievementId,
              earnedAt: new Date(persisted.earnedAt),
              progressValue: persisted.progressValue,
              isNotified: persisted.isNotified,
            }
          : record;
        userMap.set(achievement.id, existingRecord);
        return { record: existingRecord, created: false };
      }

      throw error;
    }
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
        const { record, created } = await AchievementService.persistEarnedAchievement(
          userId,
          achievement,
          currentProgress
        );
        earnedSet.add(achievement.id);
        if (!created) {
          continue;
        }
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
    const mergedByUser = new Map<string, Set<string>>();

    for (const [userId, recordsMap] of memoryUserAchievements.entries()) {
      mergedByUser.set(userId, new Set(recordsMap.keys()));
    }

    try {
      const dbRecords = await prisma.userAchievement.findMany({
        select: { userId: true, achievementId: true },
      });
      if (Array.isArray(dbRecords)) {
        for (const r of dbRecords) {
          if (!mergedByUser.has(r.userId)) {
            mergedByUser.set(r.userId, new Set());
          }
          mergedByUser.get(r.userId)!.add(r.achievementId);
        }
      }
    } catch {
      // Fallback to in-memory records when table is not migrated yet
    }

    const entries: Array<{
      userId: string;
      totalEarned: number;
      totalBonusXP: number;
    }> = [];

    for (const [userId, achievementIds] of mergedByUser.entries()) {
      let bonus = 0;
      for (const achievementId of achievementIds) {
        const def = SEEDED_ACHIEVEMENTS.find((a) => a.id === achievementId);
        if (def) bonus += def.xpBonus;
      }
      entries.push({
        userId,
        totalEarned: achievementIds.size,
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
