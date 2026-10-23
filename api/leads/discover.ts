import type { Request, Response } from 'express';
import { app } from '../../server.ts';

export default function handler(req: Request, res: Response) {
  req.url = '/api/leads/discover';
  app(req, res);
}
