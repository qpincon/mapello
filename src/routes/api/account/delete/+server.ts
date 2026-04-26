import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { getPaddle } from '$lib/server/paddle';
import { db } from '$lib/server/db';
import { subscription } from '$lib/server/subscription-schema';
import { user } from '$lib/server/auth-schema';
import { eq, and, inArray, gt } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not logged in');

	const now = new Date();
	const activeSubs = await db
		.select({ paddleSubscriptionId: subscription.paddleSubscriptionId })
		.from(subscription)
		.where(
			and(
				eq(subscription.userId, session.user.id),
				inArray(subscription.status, ['active', 'trialing'] as const),
				gt(subscription.currentPeriodEnd, now),
			),
		);

	const paddle = getPaddle();
	for (const sub of activeSubs) {
		try {
			await paddle.subscriptions.cancel(sub.paddleSubscriptionId, { effectiveFrom: 'immediately' });
		} catch {
			// Best effort — delete the account regardless
		}
	}

	// Cascade deletes sessions, subscriptions, projects
	await db.delete(user).where(eq(user.id, session.user.id));

	return json({ ok: true });
};
