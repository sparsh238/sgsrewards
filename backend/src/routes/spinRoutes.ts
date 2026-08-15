import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { getSpinStatus, doSpin } from '../controllers/spinController';

const router = Router();

router.get('/status', authMiddleware('customer'), getSpinStatus);
router.post('/', authMiddleware('customer'), doSpin);

export default router;
