import type { Repo } from './repositories/repository';

export const LOCAL_STORE_PATH = '.data/dev-store.json';

export type ServerConfig =
  | { ok: true; secret: string; store: { kind: 'mongo'; uri: string } | { kind: 'file'; path: string } }
  | { ok: false; error: string };

/**
 * Reads environment once and decides which store to use.
 * - Production: MONGODB_URI + SESSION_SECRET are required.
 * - `netlify dev`: falls back to a local JSON file and a dev secret, so the app runs with zero setup.
 *   LOCAL_STORE=1 forces the file store even if a real MONGODB_URI is present.
 */
export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const localDev = env.NETLIFY_DEV === 'true';
  const uri = env.MONGODB_URI;
  const secret = env.SESSION_SECRET ?? (localDev ? 'local-dev-secret' : undefined);

  if (!uri && !localDev) return { ok: false, error: 'Server is not configured (MONGODB_URI missing).' };
  if (!secret) return { ok: false, error: 'Server is not configured (SESSION_SECRET missing).' };

  const useFile = localDev && (env.LOCAL_STORE === '1' || !uri);
  return { ok: true, secret, store: useFile || !uri ? { kind: 'file', path: LOCAL_STORE_PATH } : { kind: 'mongo', uri } };
}

/** Lazily imports the chosen adapter so the Mongo driver isn't loaded for the file store (and vice versa). */
export async function openRepo(store: Extract<ServerConfig, { ok: true }>['store']): Promise<Repo> {
  if (store.kind === 'file') {
    console.warn(`[dev] using local file store at ${store.path} (not MongoDB)`);
    const { createFileRepo } = await import('./repositories/file.repo');
    return createFileRepo(store.path);
  }
  const { MongoRepo } = await import('./repositories/mongo.repo');
  return MongoRepo.connect(store.uri);
}
