jest.mock('../../lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    userQuestionXP: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    achievement: {
      upsert: jest.fn().mockResolvedValue({}),
    },
    userAchievement: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation(async (cb: any) =>
      cb({
        achievement: {
          upsert: jest.fn().mockResolvedValue({}),
        },
        userAchievement: {
          create: jest.fn().mockResolvedValue({}),
        },
        user: {
          update: jest.fn().mockResolvedValue({}),
        },
      })
    ),
  },
}));

import { AchievementService } from '../achievement.service';
import { BadgeService } from '../badge.service';

describe('AchievementService & BadgeService (#51)', () => {
  beforeEach(() => {
    AchievementService.clearMemoryStoreForTests();
    jest.clearAllMocks();
  });

  it('returns the full seeded catalog grouped by category', () => {
    const catalog = AchievementService.getCatalogByCategory();
    expect(catalog.categories.progress.length).toBeGreaterThanOrEqual(5);
    expect(catalog.categories.streak.length).toBeGreaterThanOrEqual(5);
    expect(catalog.categories.mastery.length).toBeGreaterThanOrEqual(5);
    expect(catalog.categories.special.length).toBeGreaterThanOrEqual(4);
  });

  it('automatically awards XP, question, and streak achievements idempotently', async () => {
    const userId = 'user-test-12345678';
    const newlyAwarded = await AchievementService.checkAndAwardAchievements(userId, {
      questionsCompleted: 1,
      totalXP: 1200,
      currentStreak: 7,
      longestStreak: 7,
    });

    const awardedIds = newlyAwarded.map((a) => a.id);
    expect(awardedIds).toContain('ach-first-steps');
    expect(awardedIds).toContain('ach-getting-warmed-up');
    expect(awardedIds).toContain('ach-learning-machine');
    expect(awardedIds).toContain('ach-consistent-learner');
    expect(awardedIds).toContain('ach-dedicated-student');

    // Re-running with identical progress must not duplicate awards
    const secondRun = await AchievementService.checkAndAwardAchievements(userId, {
      questionsCompleted: 1,
      totalXP: 1200,
      currentStreak: 7,
      longestStreak: 7,
    });
    expect(secondRun).toHaveLength(0);
  });

  it('computes user achievement overview with earned, inProgress, and summary', async () => {
    const userId = 'user-overview-87654321';
    const overview = await AchievementService.getUserAchievementsOverview(userId, {
      questionsCompleted: 1,
      totalXP: 450,
      currentStreak: 3,
      longestStreak: 3,
    });

    expect(overview.summary.totalEarned).toBe(3); // First Steps, Getting Warmed Up, Consistent Learner
    expect(overview.summary.totalBonusXP).toBe(50 + 100 + 75);

    const learningMachine = overview.inProgress.find((i) => i.id === 'ach-learning-machine');
    expect(learningMachine).toBeDefined();
    expect(learningMachine?.currentProgress).toBe(450);
    expect(learningMachine?.requirement).toBe(1000);
    expect(learningMachine?.progressPercentage).toBe(45);
  });

  it('generates badge certificates and share payloads', () => {
    const cert = BadgeService.generateCertificate(
      'user-cert-11223344',
      'Alice Learner',
      'ach-learning-machine'
    );
    expect(cert).not.toBeNull();
    expect(cert?.achievementName).toBe('Learning Machine');
    expect(cert?.xpBonus).toBe(300);
    expect(cert?.verificationCode).toContain('AURORA-ACH-LEARNING-MACHINE');
  });
});
