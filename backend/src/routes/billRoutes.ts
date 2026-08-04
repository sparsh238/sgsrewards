import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import {addBill, getUserBills, getAllBills, getBillById, editBill, deleteBill} from '../controllers/billController'

const router = Router();

router.post('/', authMiddleware('admin', 'superadmin'), addBill);
router.get('/user', authMiddleware('customer', 'admin', 'superadmin'), getUserBills);
router.get('/:id', authMiddleware('admin', 'superadmin'), getBillById);
router.get('/', authMiddleware('admin', 'superadmin'), getAllBills);
router.patch('/:id', authMiddleware('admin', 'superadmin'), editBill);
router.delete('/:id', authMiddleware('admin', 'superadmin'), deleteBill);

export default router;
