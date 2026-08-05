import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import { getUserProfile, completeProfile, updateProfile, markTierWelcomeSeen, addUserAddress, getUserAddresses, setDefaultAddress, editUserAddress, deleteUserAddress, getUserPoints, getUserOrders, addToCart, viewCart, removeFromCart, checkout, updateCartItem, changePassword, setPin } from '../controllers/userController';

const router = Router();

router.get('/profile', authMiddleware('customer'), getUserProfile);
router.post('/complete-profile', authMiddleware('customer'), completeProfile);
router.put('/profile', authMiddleware('customer'), updateProfile);
router.post('/tier-welcome-seen', authMiddleware('customer'), markTierWelcomeSeen);
router.post('/addresses', authMiddleware('customer'), addUserAddress);
router.get('/addresses', authMiddleware('customer'), getUserAddresses);
router.post('/addresses/default', authMiddleware('customer'), setDefaultAddress);
router.put('/addresses/:addressId', authMiddleware('customer'), editUserAddress);
router.delete('/addresses/:addressId', authMiddleware('customer'), deleteUserAddress);
router.get('/points', authMiddleware('customer'), getUserPoints);
router.get('/orders', authMiddleware('customer'), getUserOrders);
router.post('/cart/add', authMiddleware('customer'), addToCart);
router.delete('/cart/remove/:itemId', authMiddleware('customer'), removeFromCart);
router.post('/cart/update', authMiddleware('customer', 'admin', 'superadmin'), updateCartItem);
router.get('/cart', authMiddleware('customer'), viewCart);
router.post('/cart/checkout', authMiddleware('customer'), checkout);
// change-password is used by staff (admin/superadmin) for their forced first
// reset; dealers use set-pin instead.
// Staff only — dealers set a 4-digit PIN via /set-pin. Allowing a dealer to set a
// free-form password here would lock them out of PIN login (loginWithPin needs 4 digits).
router.post('/change-password', authMiddleware('admin', 'superadmin', 'sales'), changePassword);
router.post('/set-pin', authMiddleware('customer'), setPin);

export default router;
