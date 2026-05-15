import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { env } from '$env/dynamic/private';
import { db } from './db';
import { resend } from './email';
import { buildTransactionalEmail } from './emailTemplates';
import disposableDomains from 'disposable-email-domains';

const disposableDomainSet = new Set(disposableDomains);

const googleClientId = env.GOOGLE_CLIENT_ID;
const googleClientSecret = env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
	secret: env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production',
	baseURL: env.BETTER_AUTH_URL ?? 'http://localhost:5173',
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url }) => {
			const { html, text } = buildTransactionalEmail({
				preheader: 'Choose a new password for your Mapello account.',
				heading: 'Reset your password',
				intro: "We received a request to reset your Mapello password. Click the button below to choose a new one. If you didn't ask for this, you can safely ignore this email.",
				ctaLabel: 'Reset my password',
				ctaUrl: url,
			});
			await resend.emails.send({
				from: 'Mapello <noreply@mapello.net>',
				to: user.email,
				subject: 'Reset your Mapello password',
				text,
				html,
			});
		},
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url }) => {
			const { html, text } = buildTransactionalEmail({
				preheader: 'Confirm your email to activate your Mapello account.',
				heading: 'Welcome to Mapello',
				intro: 'Click the button below to confirm your email address and finish creating your account.',
				ctaLabel: 'Verify my email',
				ctaUrl: url,
			});
			await resend.emails.send({
				from: 'Mapello <noreply@mapello.net>',
				to: user.email,
				subject: 'Verify your Mapello email',
				text,
				html,
			});
		},
		sendOnSignUp: true,
		autoSignInAfterVerification: true,
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
						throw new APIError('BAD_REQUEST', {
							message: 'This email provider is not supported. Please use a different email address.',
						});
					}
				},
			},
		},
	},
	plugins: [sveltekitCookies(getRequestEvent)],
});
