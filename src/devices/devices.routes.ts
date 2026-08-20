import { Router } from 'express';
import { z } from 'zod';
import { AppDataSource } from '../config/data-source';
import { requireAuth } from '../middleware/auth';
import { createDevice, findDevicesForUser } from './devices.logic';

const createDeviceSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
});

export const devicesRouter = Router();
devicesRouter.use(requireAuth);

/// Post route for device "/devices"
devicesRouter.post('/', async (req, res) => {
  const data = createDeviceSchema.parse(req.body);
  const device = await createDevice(AppDataSource, req.user!.id, data);
  res.status(201).json(device);
});

/// Get route for device "/devices"
devicesRouter.get('/', async (req, res) => {
  res.json(await findDevicesForUser(AppDataSource, req.user!.id));
});
