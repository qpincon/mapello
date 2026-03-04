import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { db } from './db';
import nodemailer from 'nodemailer';

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST ?? 'localhost',
	port: Number(process.env.SMTP_PORT ?? 1025),
	secure: process.env.SMTP_SECURE === 'true',
	...(process.env.SMTP_USER
		? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
		: {}),
});

export const auth = betterAuth({
	secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production',
	baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173',
	database: drizzleAdapter(db, { provider: 'sqlite' }),
	emailAndPassword: {
		enabled: true,
		sendResetPassword: async ({ user, url }) => {
			await transporter.sendMail({
				from: process.env.SMTP_FROM ?? 'CartoSVG <noreply@localhost>',
				to: user.email,
				subject: 'Reset your CartoSVG password',
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
	},
	plugins: [sveltekitCookies(getRequestEvent)],
});
