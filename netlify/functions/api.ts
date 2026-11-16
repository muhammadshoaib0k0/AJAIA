import type { Config } from '@netlify/functions';
import { createApp, type App } from '../../server/app';
import { openRepo, readConfig } from '../../server/config';

/**
 * Netlify adapter only: reads config, builds the app once per warm instance, delegates.
 * All routing and business logic lives in /server.
 */
let app: App | null = null;

export default async (req: Request): Promise<Response> => {
  const cfg = readConfig();
  if (!cfg.ok) return Response.json({ error: cfg.error }, { status: 500 });

  if (!app) {
    try {
      app = createApp({ repo: await openRepo(cfg.store), secret: cfg.secret });
    } catch (e) {
      console.error('DB connection failed', e);
      return Response.json({ error: 'Database is unavailable. Please try again shortly.' }, { status: 503 });
    }
  }
  return app(req);
};

export const config: Config = { path: '/api/*' };
