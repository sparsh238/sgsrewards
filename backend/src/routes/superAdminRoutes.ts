import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { addUser, addSalesUser, updateSalesUser, getSalesAreas, deleteUser, blockUser, resetPassword, updatePointsConversion, refreshUserList, getAllUsers, getPointsConversion, changeUserTier, getTierBillingRequirements, updateTierBillingRequirements, getTierReview, applyTierReview, updateDealer, getSpinConfig, updateSpinConfig, getSpinLog } from '../controllers/superAdminController';

const router = Router();

router.get('/allusers', authMiddleware('superadmin'), getAllUsers);
router.post('/sausers', authMiddleware('superadmin'), addUser);
router.get('/sales-areas', authMiddleware('superadmin'), getSalesAreas);
router.get('/spin-config', authMiddleware('superadmin'), getSpinConfig);
router.put('/spin-config', authMiddleware('superadmin'), updateSpinConfig);
router.get('/spin-log', authMiddleware('superadmin'), getSpinLog);
router.post('/sales-user', authMiddleware('superadmin'), addSalesUser);
router.patch('/sales-user/:id', authMiddleware('superadmin'), updateSalesUser);
router.delete('/users/:id', authMiddleware('superadmin'), deleteUser);
router.post('/users/:id/block', authMiddleware('superadmin'), blockUser);
router.post('/users/:id/reset-password', authMiddleware('superadmin'), resetPassword);
router.get('/system/points-conversion', authMiddleware('superadmin', 'admin', 'customer', 'sales'), getPointsConversion);
router.put('/system/points-conversion', authMiddleware('superadmin'), updatePointsConversion);
router.post('/users/refresh', authMiddleware('superadmin'), refreshUserList);
router.post('/users/change-tier', authMiddleware('superadmin'), changeUserTier);
router.patch('/users/:id/details', authMiddleware('superadmin'), updateDealer);
router.get('/tier-review', authMiddleware('superadmin'), getTierReview);
router.post('/tier-review/apply', authMiddleware('superadmin'), applyTierReview);
router.get('/system/tier-billing-requirements', authMiddleware('superadmin', 'customer'), getTierBillingRequirements);
router.put('/system/tier-billing-requirements', authMiddleware('superadmin'), updateTierBillingRequirements);

export default router;
