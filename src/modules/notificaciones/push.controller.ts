// src/controllers/push.controller.ts
import { Request, Response } from 'express';
import { PushService } from './push.service';

export const PushController = {
  register: async (req: Request, res: Response) => {
    try {
      // TODO: validar auth (JWT/cookie) y usar req.user.id como userId real
      const saved = await PushService.register(req.body);
      res.json({ ok: true, data: saved });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e?.message || 'Bad request' });
    }
  },

  prefs: async (req: Request, res: Response) => {
    try {
      const updated = await PushService.updatePrefs(req.body);
      res.json({ ok: true, data: updated });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e?.message || 'Bad request' });
    }
  },

  unregister: async (req: Request, res: Response) => {
    try {
      const updated = await PushService.unregister(req.body);
      res.json({ ok: true, data: updated });
    } catch (e: any) {
      res.status(400).json({ ok: false, error: e?.message || 'Bad request' });
    }
  },
};
