import { Request, Response } from 'express';
import Item from '../models/itemModel';

// Multipart forms send booleans as strings — normalize without defaulting.
const parseIsActive = (value: unknown): boolean | undefined =>
  value === undefined ? undefined : String(value) !== 'false';

const addItem = async (req: Request, res: Response) => {
  const { name, description, pointsRequired, stock, discount } = req.body;
  const image = req.file ? req.file.path : '';

  try {
    const item = new Item({
      name, images: [image], description, pointsRequired, stock, discount,
      isActive: parseIsActive(req.body.isActive) ?? true,
    });
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};

const updateItem = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, description, pointsRequired, stock, discount } = req.body;
  const image = req.file ? req.file.path : '';

  try {
    const item = await Item.findByIdAndUpdate(
      id,
      {
        name, images: image ? [image] : undefined, description, pointsRequired, stock, discount,
        isActive: parseIsActive(req.body.isActive),
      },
      { new: true }
    );
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};

const deleteItem = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const item = await Item.findByIdAndDelete(id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error });
  }
};

const getItems = async (req: Request, res: Response) => {
    try {
      // Dealers only see live rewards; staff see everything (to manage hidden ones).
      const filter = req.user?.userType === 'customer' ? { isActive: { $ne: false } } : {};
      const items = await Item.find(filter);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: 'Internal server error', error });
  }
};

const getItemById = async (req: Request, res: Response) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).send({ error: 'item not found' });
    }
    res.send(item);
  } catch (error) {
    res.status(500).send(error);
  }
};

export { addItem, updateItem, deleteItem, getItems, getItemById };
