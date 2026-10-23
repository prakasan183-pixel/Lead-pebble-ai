import type { Request, Response } from 'express';
import { app } from '../../server.ts';

export default function handler(req: Request, res: Response) {
  req.url = '/api/ai/outreach';
  app(req, res);
}
