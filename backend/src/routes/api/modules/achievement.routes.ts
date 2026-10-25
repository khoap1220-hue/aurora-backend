import express from 'express';
import { AchievementController } from '../../../controllers/achievement.controller';
import { isAuthorized } from '../../../middlewares/authentication';

const router = express.Router();

// Public catalog & achievement leaderboard
router.get('/catalog', AchievementController.getCatalog);
router.get('/leaderboard', AchievementController.getLeaderboard);

// Authenticated user achievement & badge endpoints
router.use(isAuthorized());

router.get('/user', AchievementController.getUserAchievements);
router.post('/check', AchievementController.checkAchievements);
router.get('/badges/:achievementId/certificate', AchievementController.getBadgeCertificate);
router.get('/badges/:achievementId/share', AchievementController.shareBadge);

export default router;
