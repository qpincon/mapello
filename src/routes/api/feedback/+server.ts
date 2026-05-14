import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { resend } from '$lib/server/email';

const ALLOWED_CATEGORIES = ['bug', 'feature', 'other'] as const;
type Category = (typeof ALLOWED_CATEGORIES)[number];

const CATEGORY_LABELS: Record<Category, string> = {
	bug: 'Bug report',
	feature: 'Feature request',
	other: 'Other',
};

// In-memory rate limiter: 3 messages per user per 10 minutes
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

function checkRateLimit(userId: string): boolean {
	const now = Date.now();
	const timestamps = (rateLimitMap.get(userId) ?? []).filter(
		(t) => now - t < RATE_LIMIT_WINDOW_MS,
	);
	if (timestamps.length >= RATE_LIMIT_COUNT) return false;
	timestamps.push(now);
	rateLimitMap.set(userId, timestamps);
	return true;
}

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Unauthorized');

	if (!checkRateLimit(session.user.id)) {
		throw error(429, 'Too many feedback submissions. Please wait a few minutes.');
	}

	const body = await request.json();
	const { category, message, projectId, projectName } = body;

	if (!ALLOWED_CATEGORIES.includes(category)) throw error(400, 'Invalid category');
	if (!message || typeof message !== 'string') throw error(400, 'Message is required');
	const trimmed = message.trim();
	if (trimmed.length === 0) throw error(400, 'Message is required');
	if (trimmed.length > 5000) throw error(400, 'Message is too long (max 5000 characters)');

	const userAgent = request.headers.get('user-agent') ?? 'unknown';
	const categoryLabel = CATEGORY_LABELS[category as Category];

	const projectLine =
		projectId && projectName
			? `Project: ${projectName} (id: ${projectId})`
			: 'Project: none (not saved)';

	const metaText = [
		`From: ${session.user.email}`,
		projectLine,
		`Browser: ${userAgent}`,
	].join('\n');

	const metaHtml = [
		`<b>From:</b> ${session.user.email}`,
		`<b>${projectLine}</b>`,
		`<b>Browser:</b> ${userAgent}`,
	]
		.map((l) => `<p style="margin:0 0 4px">${l}</p>`)
		.join('');

	await resend.emails.send({
		from: 'Mapello Feedback <noreply@mapello.net>',
		to: 'support@mapello.net',
		replyTo: session.user.email,
		subject: `[${categoryLabel}] from ${session.user.email}`,
		text: `${trimmed}\n\n---\n${metaText}`,
		html: `<p style="white-space:pre-wrap">${trimmed}</p><hr/>${metaHtml}`,
	});

	return json({ ok: true });
};
