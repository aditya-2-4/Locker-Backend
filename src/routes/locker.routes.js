import { Router } from 'express';
import {
  getLockers,
  getLockerById,
  createLocker,
  unlockCompartment,
  getDeviceLogs,
  toggleLockerPower,
} from '../controllers/lockerController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', getLockers);
router.get('/logs', authenticateToken, requireAdmin, getDeviceLogs);
router.get('/:id', getLockerById);
router.post('/', authenticateToken, requireAdmin, createLocker);
router.post('/:id/unlock', authenticateToken, unlockCompartment);
router.post('/:id/power', toggleLockerPower);

export default router;
