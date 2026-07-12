import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { getPaddle } from '$lib/server/paddle';
import { db } from '$lib/server/db';
import { subscription } from '$lib/server/subscription-schema';
import { eq, and, inArray, gt } from 'drizzle-orm';
import { REFUND_WINDOW_DAYS } from '$lib/billing-constants';

const WINDOW_MS = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not logged in');

	const now = new Date();
	const [sub] = await db
		.select()
		.from(subscription)
		.where(
			and(
				eq(subscription.userId, session.user.id),
				inArray(subscription.status, ['active', 'trialing'] as const),
				gt(subscription.currentPeriodEnd, now),
			),
		)
		.limit(1);

	if (!sub) throw error(404, 'No active subscription');

	if (sub.refundRequestedAt) throw error(400, 'Refund already requested');

	const paddle = getPaddle();

	// Find the earliest completed transaction for this subscription — this is what we refund
	const txCollection = paddle.transactions.list({
		subscriptionId: [sub.paddleSubscriptionId],
		status: ['completed'],
		orderBy: 'billed_at[ASC]',
		perPage: 1,
	});
	const [initialTxn] = await txCollection.next();

	if (!initialTxn) throw error(404, 'No completed transaction found for this subscription');

	// Authoritative 30-day window check against actual Paddle billing date
	const billedAt = initialTxn.billedAt ? new Date(initialTxn.billedAt).getTime() : 0;
	if (Date.now() - billedAt > WINDOW_MS) {
		throw error(403, JSON.stringify({ reason: 'window_expired' }));
	}

	// Submit full refund adjustment to Paddle (lands in pending_approval — Paddle reviews it)
	await paddle.adjustments.create({
		action: 'refund',
		type: 'full',
		transactionId: initialTxn.id,
		reason: 'Customer requested refund within 30-day money-back window',
	});

	// Revoke access immediately by cancelling the subscription now
	await paddle.subscriptions.cancel(sub.paddleSubscriptionId, { effectiveFrom: 'immediately' });

	// Optimistically mark refund requested; webhook will confirm final canceled status
	await db
		.update(subscription)
		.set({ refundRequestedAt: now, cancelAtPeriodEnd: true, updatedAt: now })
		.where(eq(subscription.id, sub.id));

	return json({ ok: true });
};
