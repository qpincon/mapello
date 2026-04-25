import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { Resend } from 'resend';
import disposableDomains from 'disposable-email-domains';

const disposableDomainSet = new Set(disposableDomains);

const googleClientId = env.GOOGLE_CLIENT_ID;
const googleClientSecret = env.GOOGLE_CLIENT_SECRET;

const resend = new Resend(env.RESEND_API_KEY);

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production',
	baseURL: env.BETTER_AUTH_URL ?? 'http://localhost:5173',
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	emailAndPassword: {
		enabled: true,
		sendResetPassword: async ({ user, url }) => {
			await resend.emails.send({
				from: 'Mapello <noreply@mapello.net>',
				to: user.email,
				subject: 'Reset your Mapello password',
				text: `Click the link below to reset your password:\n\n${url}\n\nThis link expires in 1 hour.`,
				html: `<p>Click the link below to reset your password:</p><p><a href="${url}">${url}</a></p><p>This link expires in 1 hour.</p>`,
			});
		},
	},
	socialProviders: {
		...(googleClientId && googleClientSecret
			? {
				google: {
					clientId: googleClientId,
					clientSecret: googleClientSecret,
				},
			}
			: {}),
		...(env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET
			? {
				facebook: {
					clientId: env.FACEBOOK_CLIENT_ID,
					clientSecret: env.FACEBOOK_CLIENT_SECRET,
				},
			}
			: {}),
	},
	databaseHooks: {
		user: {
			create: {
				before: async (user) => {
					const domain = user.email.split('@')[1]?.toLowerCase();
					if (domain && disposableDomainSet.has(domain)) {
						return false;
					}
				},
			},
		},
	},
	plugins: [sveltekitCookies(getRequestEvent)],
});
