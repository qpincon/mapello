import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
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

// The repo (and this fallback secret) is public, so falling back to it in production would mean
// session cookies are forgeable by anyone who reads the source. Fail loudly at startup instead of
// silently serving with a known signing key.
const isProd = process.env.NODE_ENV === 'production';
if (isProd && (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32)) {
	throw new Error('BETTER_AUTH_SECRET is not set (or is shorter than 32 chars) in production');
}
if (isProd && !env.BETTER_AUTH_URL) {
	throw new Error('BETTER_AUTH_URL is not set in production');
}

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
	},
	account: {
		accountLinking: {
			enabled: true,
			// Pins the fix for GHSA-g38m-r43w-p2q7 (account takeover via OAuth auto-link to an
			// unverified pre-registered email) as our own config rather than relying on the
			// library default: an attacker who pre-registers a victim's email with a password
			// (requireEmailVerification means that row stays unverified) must not have the
			// victim's later Google sign-in auto-link into that attacker-owned row. better-auth
			// >=1.7 defaults this to true already, but we assert it explicitly so a future
			// library default change can't silently reopen the hole.
			requireLocalEmailVerified: true,
			allowDifferentEmails: false,
		},
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
	hooks: {
		before: createAuthMiddleware(async (ctx) => {
			if (ctx.path !== '/sign-up/email') return;
			const body = ctx.body as { email?: unknown } | undefined;
			const email = typeof body?.email === 'string' ? body.email.toLowerCase().trim() : undefined;
			if (!email) return;
			const existing = await ctx.context.internalAdapter.findUserByEmail(email);
			if (existing?.user) {
				throw new APIError('UNPROCESSABLE_ENTITY', {
					message: 'This email is already registered. Sign in instead.',
				});
			}
		}),
	},
});
