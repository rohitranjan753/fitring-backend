import { Router } from 'express';
import { z } from 'zod';
import { AppDataSource } from '../config/data-source';
import { requireAuth } from '../middleware/auth';
import { addOrUpdateCartItem, findCartForUser } from './cart.logic';

const addToCartSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1),
});

export const cartRouter = Router();
cartRouter.use(requireAuth);

cartRouter.post('/', async (req, res) => {
  const { productId, quantity } = addToCartSchema.parse(req.body);
  const item = await addOrUpdateCartItem(
    AppDataSource,
    req.user!.id,
    productId,
    quantity,
  );
  res.json(item);
});

cartRouter.get('/', async (req, res) => {
  res.json(await findCartForUser(AppDataSource, req.user!.id));
});
