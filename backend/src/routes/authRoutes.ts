import { Router } from 'express';
import { register, login, loginWithPin, refreshToken, logout } from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);           // staff (admin/superadmin): username + password
router.post('/login-pin', loginWithPin); // dealers: phone number + 4-digit PIN
router.post('/refresh-token', refreshToken);
router.post('/logout', logout);

export default router;
