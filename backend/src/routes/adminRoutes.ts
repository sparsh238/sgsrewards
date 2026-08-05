import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { getUsers, getUserById, getDealerSummary, getOrders, getOrderById, updateOrderStatus, addCustomer, addCustomers, getOverview, getCalendar } from '../controllers/adminController';

const router = Router();

router.get('/users', authMiddleware('admin', 'superadmin', 'sales'), getUsers);
router.get('/users/:id/summary', authMiddleware('admin', 'superadmin', 'sales'), getDealerSummary);
router.get('/users/:id', authMiddleware('admin', 'superadmin', 'sales'), getUserById);
router.post('/add-customer', authMiddleware('admin', 'superadmin'), addCustomer);
router.post('/add-customers', authMiddleware('admin', 'superadmin'), addCustomers);
router.get('/orders', authMiddleware('admin', 'superadmin', 'sales'), getOrders);
router.get('/overview', authMiddleware('admin', 'superadmin', 'sales'), getOverview);
router.get('/calendar', authMiddleware('admin', 'superadmin', 'sales'), getCalendar);
router.get('/:orderId', authMiddleware('customer', 'admin', 'superadmin', 'sales'), getOrderById);
router.patch('/:orderId/status', authMiddleware('admin', 'superadmin'), updateOrderStatus);

export default router;
