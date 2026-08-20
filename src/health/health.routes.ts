import { Router } from 'express';
import { z} from 'zod';
import { AppDataSource } from '../config/data-source';
import { requireAuth } from '../middleware/auth';
import {
  findReadings,
  ingestReadings,
  summarizeReadings,
} from './health.logic';

/// The health data schema which we will read
const readingItemSchema = z.object({
  clientUuid: z.uuid(),
  heartRate: z.number().int().min(0).max(300),
  spo2: z.number().int().min(0).max(100),
  steps: z.number().int().min(0),
  recordedAt: z.iso.datetime(),
});

/// for feediing records in batches
const ingestSchema = z.object({
  deviceId: z.uuid(),
  readings: z.array(readingItemSchema).min(1),
});

/// Reding schema query
const readingsQuerySchema = z.object({
  deviceId: z.uuid(),
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/// Summary query schema predefined
const summaryQuerySchema = z.object({
  deviceId: z.uuid(),
  range: z.enum(['daily', 'weekly']).optional(),
});

export const healthRouter = Router();
healthRouter.use(requireAuth);

// Batch-capable — the mobile sync queue drains in batches of ~50, not one
// request per reading.
/// "/health/readings"
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

/// To get the reading of a particular user based on particular device id
/// "/health/readings"
healthRouter.get('/readings', async (req, res) => {
  const { deviceId, before, limit } = readingsQuerySchema.parse(req.query);
  const result = await findReadings(AppDataSource, req.user!.id, deviceId, {
    before,
    limit,
  });
  res.json(result);
});

/// To get summary of the data collected, we can keep the logic anything to generate summary
/// ""/health/summary
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
