import type { Config } from 'drizzle-kit';

export default {
	schema: ['./src/lib/server/schema.ts', './src/lib/server/auth-schema.ts', './src/lib/server/subscription-schema.ts'],
	out: './drizzle',
	dialect: 'sqlite',
	dbCredentials: {
		url: './data/mapello.db',
	},
} satisfies Config;
