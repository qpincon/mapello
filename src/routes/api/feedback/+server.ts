import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/session';
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

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export const POST: RequestHandler = async ({ request }) => {
	const user = await requireUser(request);

	if (!checkRateLimit(user.id)) {
		throw error(429, 'Too many feedback submissions. Please wait a few minutes.');
	}

	const body = await request.json();
	const { category, message, projectId, projectName } = body;

	if (!ALLOWED_CATEGORIES.includes(category)) throw error(400, 'Invalid category');
	if (!message || typeof message !== 'string') throw error(400, 'Message is required');
	const trimmed = message.trim();
	if (trimmed.length === 0) throw error(400, 'Message is required');
	if (trimmed.length > 5000) throw error(400, 'Message is too long (max 5000 characters)');

	const validProjectId = Number.isInteger(projectId) ? projectId : undefined;
	const validProjectName = typeof projectName === 'string' ? projectName : undefined;

	const userAgent = request.headers.get('user-agent') ?? 'unknown';
	const categoryLabel = CATEGORY_LABELS[category as Category];

	const projectLine =
		validProjectId !== undefined && validProjectName
			? `Project: ${validProjectName} (id: ${validProjectId})`
			: 'Project: none (not saved)';

	const metaText = [
		`From: ${user.email}`,
		projectLine,
		`Browser: ${userAgent}`,
	].join('\n');

	const metaHtml = [
		`<b>From:</b> ${escapeHtml(user.email)}`,
		`<b>${escapeHtml(projectLine)}</b>`,
		`<b>Browser:</b> ${escapeHtml(userAgent)}`,
	]
		.map((l) => `<p style="margin:0 0 4px">${l}</p>`)
		.join('');

	await resend.emails.send({
		from: 'Mapello Feedback <noreply@mapello.net>',
		to: 'support@mapello.net',
		replyTo: user.email,
		subject: `[${categoryLabel}] from ${user.email}`,
		text: `${trimmed}\n\n---\n${metaText}`,
		html: `<p style="white-space:pre-wrap">${escapeHtml(trimmed)}</p><hr/>${metaHtml}`,
	});

	return json({ ok: true });
};
