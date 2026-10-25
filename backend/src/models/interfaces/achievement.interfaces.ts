export type AchievementCategory = 'progress' | 'streak' | 'mastery' | 'special';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type AchievementRequirementType =
  | 'questions_completed'
  | 'xp_total'
  | 'streak_days'
  | 'consecutive_correct'
  | 'speed_bonus_count'
  | 'levels_completed'
  | 'grammar_questions'
  | 'vocabulary_questions'
  | 'early_adopter'
  | 'weekend_lessons'
  | 'night_owl_lessons'
  | 'referrals_completed';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  requirementType: AchievementRequirementType;
  requirementValue: number;
  requirementText: string;
  xpBonus: number;
  badgeUrl: string;
  rarity: AchievementRarity;
  isActive: boolean;
}

export interface UserAchievementRecord {
  id: string;
  userId: string;
  achievementId: string;
  earnedAt: Date;
  progressValue: number;
  isNotified: boolean;
}

export interface UserProgressSnapshot {
  userId: string;
  totalXP: number;
  currentStreak: number;
  longestStreak: number;
  questionsCompleted: number;
  consecutiveCorrect?: number;
  speedBonusCount?: number;
  levelsCompleted?: number;
  grammarQuestions?: number;
  vocabularyQuestions?: number;
  isEarlyAdopter?: boolean;
  weekendLessons?: number;
  nightOwlLessons?: number;
  referralsCompleted?: number;
}

export const SEEDED_ACHIEVEMENTS: AchievementDefinition[] = [
  // Progress Achievements
  {
    id: 'ach-first-steps',
    name: 'First Steps',
    description: 'Complete your first question',
    category: 'progress',
    requirementType: 'questions_completed',
    requirementValue: 1,
    requirementText: 'Complete 1 question',
    xpBonus: 50,
    badgeUrl: '/badges/first-steps.svg',
    rarity: 'common',
    isActive: true,
  },
  {
    id: 'ach-getting-warmed-up',
    name: 'Getting Warmed Up',
    description: 'Earn 100 total XP',
    category: 'progress',
    requirementType: 'xp_total',
    requirementValue: 100,
    requirementText: 'Earn 100 total XP',
    xpBonus: 100,
    badgeUrl: '/badges/getting-warmed-up.svg',
    rarity: 'common',
    isActive: true,
  },
  {
    id: 'ach-learning-machine',
    name: 'Learning Machine',
    description: 'Earn 1,000 total XP',
    category: 'progress',
    requirementType: 'xp_total',
    requirementValue: 1000,
    requirementText: 'Earn 1,000 total XP',
    xpBonus: 300,
    badgeUrl: '/badges/learning-machine.svg',
    rarity: 'rare',
    isActive: true,
  },
  {
    id: 'ach-knowledge-seeker',
    name: 'Knowledge Seeker',
    description: 'Earn 5,000 total XP',
    category: 'progress',
    requirementType: 'xp_total',
    requirementValue: 5000,
    requirementText: 'Earn 5,000 total XP',
    xpBonus: 500,
    badgeUrl: '/badges/knowledge-seeker.svg',
    rarity: 'epic',
    isActive: true,
  },
  {
    id: 'ach-english-master',
    name: 'English Master',
    description: 'Earn 10,000 total XP',
    category: 'progress',
    requirementType: 'xp_total',
    requirementValue: 10000,
    requirementText: 'Earn 10,000 total XP',
    xpBonus: 1000,
    badgeUrl: '/badges/english-master.svg',
    rarity: 'legendary',
    isActive: true,
  },

  // Streak Achievements
  {
    id: 'ach-consistent-learner',
    name: 'Consistent Learner',
    description: 'Maintain a 3-day learning streak',
    category: 'streak',
    requirementType: 'streak_days',
    requirementValue: 3,
    requirementText: '3-day streak',
    xpBonus: 75,
    badgeUrl: '/badges/consistent-learner.svg',
    rarity: 'common',
    isActive: true,
  },
  {
    id: 'ach-dedicated-student',
    name: 'Dedicated Student',
    description: 'Maintain a 7-day learning streak',
    category: 'streak',
    requirementType: 'streak_days',
    requirementValue: 7,
    requirementText: '7-day streak',
    xpBonus: 200,
    badgeUrl: '/badges/dedicated-student.svg',
    rarity: 'rare',
    isActive: true,
  },
  {
    id: 'ach-unstoppable-force',
    name: 'Unstoppable Force',
    description: 'Maintain a 15-day learning streak',
    category: 'streak',
    requirementType: 'streak_days',
    requirementValue: 15,
    requirementText: '15-day streak',
    xpBonus: 500,
    badgeUrl: '/badges/unstoppable-force.svg',
    rarity: 'epic',
    isActive: true,
  },
  {
    id: 'ach-learning-legend',
    name: 'Learning Legend',
    description: 'Maintain a 30-day learning streak',
    category: 'streak',
    requirementType: 'streak_days',
    requirementValue: 30,
    requirementText: '30-day streak',
    xpBonus: 1000,
    badgeUrl: '/badges/learning-legend.svg',
    rarity: 'legendary',
    isActive: true,
  },
  {
    id: 'ach-streak-master',
    name: 'Streak Master',
    description: 'Maintain a 100-day learning streak',
    category: 'streak',
    requirementType: 'streak_days',
    requirementValue: 100,
    requirementText: '100-day streak',
    xpBonus: 2500,
    badgeUrl: '/badges/streak-master.svg',
    rarity: 'legendary',
    isActive: true,
  },

  // Mastery Achievements
  {
    id: 'ach-perfect-score',
    name: 'Perfect Score',
    description: 'Get 10 questions correct in a row',
    category: 'mastery',
    requirementType: 'consecutive_correct',
    requirementValue: 10,
    requirementText: '10 correct answers in a row',
    xpBonus: 150,
    badgeUrl: '/badges/perfect-score.svg',
    rarity: 'rare',
    isActive: true,
  },
  {
    id: 'ach-speed-demon',
    name: 'Speed Demon',
    description: 'Complete 20 questions with time bonus',
    category: 'mastery',
    requirementType: 'speed_bonus_count',
    requirementValue: 20,
    requirementText: '20 questions with time bonus',
    xpBonus: 200,
    badgeUrl: '/badges/speed-demon.svg',
    rarity: 'rare',
    isActive: true,
  },
  {
    id: 'ach-level-conqueror',
    name: 'Level Conqueror',
    description: 'Complete 50 questions at each level A1-C2',
    category: 'mastery',
    requirementType: 'levels_completed',
    requirementValue: 6,
    requirementText: 'Complete 50 questions across all 6 CEFR levels',
    xpBonus: 500,
    badgeUrl: '/badges/level-conqueror.svg',
    rarity: 'epic',
    isActive: true,
  },
  {
    id: 'ach-grammar-guru',
    name: 'Grammar Guru',
    description: 'Complete 100 grammar questions',
    category: 'mastery',
    requirementType: 'grammar_questions',
    requirementValue: 100,
    requirementText: 'Complete 100 grammar questions',
    xpBonus: 300,
    badgeUrl: '/badges/grammar-guru.svg',
    rarity: 'epic',
    isActive: true,
  },
  {
    id: 'ach-vocabulary-virtuoso',
    name: 'Vocabulary Virtuoso',
    description: 'Complete 100 vocabulary questions',
    category: 'mastery',
    requirementType: 'vocabulary_questions',
    requirementValue: 100,
    requirementText: 'Complete 100 vocabulary questions',
    xpBonus: 300,
    badgeUrl: '/badges/vocabulary-virtuoso.svg',
    rarity: 'epic',
    isActive: true,
  },

  // Special Achievements
  {
    id: 'ach-early-adopter',
    name: 'Early Adopter',
    description: 'Join Aurora in first month',
    category: 'special',
    requirementType: 'early_adopter',
    requirementValue: 1,
    requirementText: 'Join Aurora in first month',
    xpBonus: 500,
    badgeUrl: '/badges/early-adopter.svg',
    rarity: 'legendary',
    isActive: true,
  },
  {
    id: 'ach-weekend-warrior',
    name: 'Weekend Warrior',
    description: 'Complete lessons on 10 weekends',
    category: 'special',
    requirementType: 'weekend_lessons',
    requirementValue: 10,
    requirementText: 'Complete lessons on 10 weekends',
    xpBonus: 250,
    badgeUrl: '/badges/weekend-warrior.svg',
    rarity: 'rare',
    isActive: true,
  },
  {
    id: 'ach-night-owl',
    name: 'Night Owl',
    description: 'Complete 20 lessons after 10 PM',
    category: 'special',
    requirementType: 'night_owl_lessons',
    requirementValue: 20,
    requirementText: 'Complete 20 lessons after 10 PM',
    xpBonus: 200,
    badgeUrl: '/badges/night-owl.svg',
    rarity: 'rare',
    isActive: true,
  },
  {
    id: 'ach-social-learner',
    name: 'Social Learner',
    description: 'Refer 3 friends who complete 10 questions',
    category: 'special',
    requirementType: 'referrals_completed',
    requirementValue: 3,
    requirementText: 'Refer 3 active friends',
    xpBonus: 1000,
    badgeUrl: '/badges/social-learner.svg',
    rarity: 'legendary',
    isActive: true,
  },
];
