import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../lib/http.js';
import { getSetting, setSetting, audit } from '../db.js';

export const DEFAULT_SETTINGS = {
  channelName: 'EA KIDS',
  defaultLanguage: 'ar',
  defaultFormat: 'landscape',
  fps: 30,
  limits: { dailyUsd: 0, monthlyUsd: 0 },     // 0 = paid operations blocked until you raise the limit
  providers: { llm: 'offline_templates', tts: 'espeak', image: 'local_svg' },
  compliance: { requireHumanReview: true },
};

export default function systemRoutes(ctx) {
  const { db, caps, auth, cfg } = ctx;
  const r = Router();

  r.get('/status', async (_req, res) => {
    const c = await caps.detect();
    res.json({ version: '1.0.0', env: cfg.env, capabilities: c, node: process.version });
  });

  r.get('/settings', (_req, res) => res.json({ settings: { ...DEFAULT_SETTINGS, ...getSetting(db, 'app', {}) } }));
  r.put('/settings', auth.requirePerm('admin'), (req, res) => {
    const s = validate(z.object({
      channelName: z.string().min(1).max(80),
      defaultLanguage: z.enum(['ar', 'en']),
      defaultFormat: z.enum(['landscape', 'shorts']),
      fps: z.number().int().refine((n) => [24, 25, 30, 50, 60].includes(n), 'fps must be 24, 25, 30, 50 or 60'),
      limits: z.object({ dailyUsd: z.number().min(0).max(100000), monthlyUsd: z.number().min(0).max(1000000) }),
      providers: z.object({ llm: z.string(), tts: z.string(), image: z.string() }),
      compliance: z.object({ requireHumanReview: z.literal(true) }),
    }), req.body);
    setSetting(db, 'app', s);
    audit(db, req.user.id, 'settings_updated', 'settings', 'app', s);
    res.json({ settings: s });
  });
  return r;
}
