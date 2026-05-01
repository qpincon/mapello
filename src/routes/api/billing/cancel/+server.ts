import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { getPaddle } from '$lib/server/paddle';
import { db } from '$lib/server/db';
import { subscription } from '$lib/server/subscription-schema';
import { eq, and, inArray, gt } from 'drizzle-orm';

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
	if (sub.cancelAtPeriodEnd) throw error(400, 'Already scheduled for cancellation');

	const paddle = getPaddle();
	await paddle.subscriptions.cancel(sub.paddleSubscriptionId, { effectiveFrom: 'next_billing_period' });

	// Optimistically update DB; webhook will confirm
	await db
		.update(subscription)
		.set({ cancelAtPeriodEnd: true, updatedAt: now })
		.where(eq(subscription.id, sub.id));

	return json({ ok: true, endsAt: sub.currentPeriodEnd });
};
