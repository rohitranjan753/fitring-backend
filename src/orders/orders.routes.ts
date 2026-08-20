import { Router } from 'express';
import { AppDataSource } from '../config/data-source';
import { requireAuth } from '../middleware/auth';
import { findOrdersForUser, placeOrder } from './orders.logic';

export const ordersRouter = Router();
ordersRouter.use(requireAuth);

ordersRouter.post('/', async (req, res) => {
  const order = await placeOrder(AppDataSource, req.user!.id);
  res.status(201).json(order);
});

ordersRouter.get('/', async (req, res) => {
  res.json(await findOrdersForUser(AppDataSource, req.user!.id));
});
