import { Router } from 'express';
import {
  getBooks,
  getBookById,
  createBook,
  reserveBook,
  updateBookStatus,
} from '../controllers/bookController.js';
import { authenticateToken, optionalAuth, requireAdmin } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', getBooks);
router.get('/:id', getBookById);
router.post('/', optionalAuth, createBook);
router.post('/:id/reserve', authenticateToken, reserveBook);
router.patch('/:id/status', authenticateToken, requireAdmin, updateBookStatus);

export default router;
