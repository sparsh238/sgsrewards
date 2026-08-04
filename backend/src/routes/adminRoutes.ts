import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { getUsers, getUserById, getOrders, getOrderById, updateOrderStatus, addCustomer, addCustomers, getOverview } from '../controllers/adminController';

const router = Router();

router.get('/users', authMiddleware('admin', 'superadmin'), getUsers);
router.get('/users/:id', authMiddleware('admin', 'superadmin'), getUserById);
router.post('/add-customer', authMiddleware('admin', 'superadmin'), addCustomer);
router.post('/add-customers', authMiddleware('admin', 'superadmin'), addCustomers);
router.get('/orders', authMiddleware('admin', 'superadmin'), getOrders);
router.get('/overview', authMiddleware('admin', 'superadmin'), getOverview);
router.get('/:orderId', authMiddleware('customer', 'admin', 'superadmin'), getOrderById);
router.patch('/:orderId/status', authMiddleware('admin', 'superadmin'), updateOrderStatus);

export default router;
