import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import * as authSchema from './auth-schema';
import * as subscriptionSchema from './subscription-schema';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const dbPath = resolve('data/mapello.db');
mkdirSync(resolve('data'), { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema: { ...schema, ...authSchema, ...subscriptionSchema } });
