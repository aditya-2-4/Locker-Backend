import { Router } from 'express';
import {
  registerRFID,
  unmapRFID,
  listRFIDUsers,
  simulateHardwareEvent,
} from '../controllers/rfidController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/users', authenticateToken, requireAdmin, listRFIDUsers);
router.post('/register', authenticateToken, requireAdmin, registerRFID);
router.delete('/:userId', authenticateToken, requireAdmin, unmapRFID);
router.post('/simulate', simulateHardwareEvent); // testbench simulator trigger

export default router;
