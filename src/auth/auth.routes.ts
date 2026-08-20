import { Router } from 'express';
import { z } from 'zod';
import { AppDataSource } from '../config/data-source';
import { login } from './auth.logic';

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const result = await login(AppDataSource, email, password);
  res.json(result);
});
