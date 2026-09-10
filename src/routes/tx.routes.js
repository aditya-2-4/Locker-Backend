import { Router } from 'express';
import { getTransactions, getStats } from '../controllers/txController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', authenticateToken, requireAdmin, getTransactions);
router.get('/stats', getStats); // stats can be shown on public/admin views

export default router;
