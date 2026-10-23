import type { Request, Response } from 'express';
import { app } from '../../server.ts';

export default function handler(req: Request, res: Response) {
  const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  req.url = `/api/location/reverse-geocode${query}`;
  app(req, res);
}
