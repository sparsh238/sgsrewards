import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { getUsers, getUserById, getDealerSummary, getOrders, getOrderById, updateOrderStatus, addCustomer, addCustomers, getOverview, getCalendar } from '../controllers/adminController';

const router = Router();

router.get('/users', authMiddleware('admin', 'superadmin'), getUsers);
router.get('/users/:id/summary', authMiddleware('admin', 'superadmin'), getDealerSummary);
router.get('/users/:id', authMiddleware('admin', 'superadmin'), getUserById);
router.post('/add-customer', authMiddleware('admin', 'superadmin'), addCustomer);
router.post('/add-customers', authMiddleware('admin', 'superadmin'), addCustomers);
router.get('/orders', authMiddleware('admin', 'superadmin'), getOrders);
router.get('/overview', authMiddleware('admin', 'superadmin'), getOverview);
router.get('/calendar', authMiddleware('admin', 'superadmin'), getCalendar);
router.get('/:orderId', authMiddleware('customer', 'admin', 'superadmin'), getOrderById);
router.patch('/:orderId/status', authMiddleware('admin', 'superadmin'), updateOrderStatus);

export default router;
