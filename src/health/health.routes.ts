import { Router } from 'express';
import { z } from 'zod';
import { AppDataSource } from '../config/data-source';
import { requireAuth } from '../middleware/auth';
import {
  findReadings,
  ingestReadings,
  summarizeReadings,
} from './health.logic';

const readingItemSchema = z.object({
  clientUuid: z.uuid(),
  heartRate: z.number().int().min(0).max(300),
  spo2: z.number().int().min(0).max(100),
  steps: z.number().int().min(0),
  recordedAt: z.iso.datetime(),
});

const ingestSchema = z.object({
  deviceId: z.uuid(),
  readings: z.array(readingItemSchema).min(1),
});

const readingsQuerySchema = z.object({
  deviceId: z.uuid(),
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const summaryQuerySchema = z.object({
  deviceId: z.uuid(),
  range: z.enum(['daily', 'weekly']).optional(),
});

export const healthRouter = Router();
healthRouter.use(requireAuth);

// Batch-capable — the mobile sync queue drains in batches of ~50, not one
// request per reading.
healthRouter.post('/readings', async (req, res) => {
  const { deviceId, readings } = ingestSchema.parse(req.body);
  const result = await ingestReadings(
    AppDataSource,
    req.user!.id,
    deviceId,
    readings,
  );
  res.json(result);
});

healthRouter.get('/readings', async (req, res) => {
  const { deviceId, before, limit } = readingsQuerySchema.parse(req.query);
  const result = await findReadings(AppDataSource, req.user!.id, deviceId, {
    before,
    limit,
  });
  res.json(result);
});

healthRouter.get('/summary', async (req, res) => {
  const { deviceId, range } = summaryQuerySchema.parse(req.query);
  const result = await summarizeReadings(
    AppDataSource,
    req.user!.id,
    deviceId,
    range ?? 'daily',
  );
  res.json(result);
});
