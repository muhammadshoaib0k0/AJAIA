import { DEMO_PASSWORD, SEED_USERS } from '../../shared/constants';
import type { User } from '../../shared/types';
import { hashPassword, verifyPassword } from '../auth/password';
import { conflict, HttpError } from '../http/errors';
import type { Repo, StoredUser } from '../repositories/repository';

// Best-effort brute-force throttle, per server instance (documented limitation; a shared store would fix it).
const MAX_FAILS = 5;
const LOCK_MS = 5 * 60_000;
const DUMMY_HASH = hashPassword('not-a-real-password'); // equalizes timing for unknown emails

let demoHashes: Promise<Map<string, string>> | null = null;
const getDemoHashes = () => (demoHashes ??= (async () => {
  const m = new Map<string, string>();
  for (const u of SEED_USERS) m.set(u.id, await hashPassword(DEMO_PASSWORD));
  return m;
})());

const toPublic = (u: StoredUser): User => ({ id: u.id, email: u.email, name: u.name });

export function createAuthService(repo: Repo) {
  const failures = new Map<string, { n: number; until: number }>();
  let seeding: Promise<void> | null = null;

  async function seed() {
    const hashes = await getDemoHashes();
    for (const u of SEED_USERS) {
      const hash = hashes.get(u.id)!;
      // New database: create. Existing demo user from before passwords existed: repair in place.
      if ((await repo.createUser({ ...u, passwordHash: hash })) === 'duplicate') await repo.setPasswordHashIfMissing(u.id, hash);
    }
  }

  return {
    /** Idempotent; runs once per instance and retries on the next request if it failed. */
    ensureDemoUsers(): Promise<void> {
      return (seeding ??= seed().catch((e) => { seeding = null; throw e; }));
    },

    getUser: (id: string) => repo.getUser(id),

    async login(email: string, password: string): Promise<User> {
      const f = failures.get(email);
      if (f && f.until > Date.now()) throw new HttpError(429, 'Too many failed attempts. Please try again in a few minutes.');
      const user = await repo.getUserByEmail(email);
      const ok = await verifyPassword(password, user?.passwordHash ?? (await DUMMY_HASH));
      if (!user || !ok) {
        const n = (f?.n ?? 0) + 1;
        failures.set(email, n >= MAX_FAILS ? { n: 0, until: Date.now() + LOCK_MS } : { n, until: 0 });
        throw new HttpError(401, 'Invalid email or password.');
      }
      failures.delete(email);
      return toPublic(user);
    },

    async signup(input: { name: string; email: string; password: string }): Promise<User> {
      const user: StoredUser = { id: `u_${crypto.randomUUID()}`, email: input.email, name: input.name, passwordHash: await hashPassword(input.password) };
      if ((await repo.createUser(user)) === 'duplicate') {
        const msg = 'An account with this email already exists.';
        throw conflict(msg, { email: msg });
      }
      return toPublic(user);
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;
