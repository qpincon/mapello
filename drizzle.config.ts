import type { Config } from 'drizzle-kit';

export default {
	schema: ['./src/lib/server/schema.ts', './src/lib/server/auth-schema.ts'],
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: './data/cartosvg.db',
	},
} satisfies Config;
