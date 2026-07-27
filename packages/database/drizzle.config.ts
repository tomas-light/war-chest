import { defineConfig } from 'drizzle-kit';
import { loadDatabaseConfig } from './src/config/index.js';

const config = loadDatabaseConfig();

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './migrations',
  dbCredentials: {
    url: config.DATABASE_URL,
    ssl: config.DATABASE_SSL ? 'require' : false,
  },
  strict: true,
  verbose: true,
});
