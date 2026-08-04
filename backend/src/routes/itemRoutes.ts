import { Router } from 'express';
import authMiddleware from '../middleware/authMiddleware';
import upload from '../config/multerConfig';  // Make sure this path is correct
import { addItem, updateItem, deleteItem, getItems, getItemById } from '../controllers/itemController';

const router = Router();

// Use the `upload` middleware
router.post('/', authMiddleware('admin','superadmin'), upload, addItem);
router.put('/:id', authMiddleware('admin','superadmin'), upload, updateItem);
router.delete('/:id', authMiddleware('admin','superadmin'), deleteItem);
router.get('/', getItems);
router.get('/itm/:id', getItemById);

export default router;
