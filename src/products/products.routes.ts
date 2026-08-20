import { Router } from 'express';
import { z } from 'zod';
import { AppDataSource } from '../config/data-source';
import { findAllProducts, findProduct } from './products.logic';

const idParamSchema = z.object({ id: z.uuid() });

export const productsRouter = Router();

productsRouter.get('/', async (_req, res) => {
  res.json(await findAllProducts(AppDataSource));
});

productsRouter.get('/:id', async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  res.json(await findProduct(AppDataSource, id));
});
