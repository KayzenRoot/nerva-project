import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/db/src/schema.ts',
  out: './packages/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://nerva:nerva@127.0.0.1:5432/nerva',
  },
  strict: true,
  verbose: true,
});
