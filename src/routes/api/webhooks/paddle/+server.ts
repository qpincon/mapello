import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import { getPaddle, getWebhookSecret } from '$lib/server/paddle';
import {
	isWebhookEventProcessed,
	recordWebhookEvent,
	upsertSubscriptionFromPaddle,
} from '$lib/server/subscription';
import { db } from '$lib/server/db';
import { user } from '$lib/server/auth-schema';
import { eq } from 'drizzle-orm';
import type { SubscriptionStatus } from '$lib/server/subscription-schema';
import type { SubscriptionNotification } from '@paddle/paddle-node-sdk';

const SUBSCRIPTION_EVENTS = new Set([
	'subscription.created',
	'subscription.updated',
	'subscription.activated',
	'subscription.canceled',
	'subscription.past_due',
	'subscription.paused',
	'subscription.trialing',
]);

export const POST: RequestHandler = async ({ request }) => {
	const signature = request.headers.get('Paddle-Signature');
	if (!signature) throw error(401, 'Missing Paddle-Signature header');

	const body = await request.text();

	let event: Awaited<ReturnType<ReturnType<typeof getPaddle>['webhooks']['unmarshal']>>;
	try {
		const paddle = getPaddle();
		event = await paddle.webhooks.unmarshal(body, getWebhookSecret(), signature);
	} catch {
		throw error(401, 'Invalid webhook signature');
	}

	if (!event) throw error(400, 'Could not parse event');

	// Idempotency: skip already-processed events
	if (await isWebhookEventProcessed(event.eventId)) {
		return json({ ok: true });
	}

	// Record event before processing so retries are safe
	await recordWebhookEvent(event.eventId, event.eventType, body);

	if (SUBSCRIPTION_EVENTS.has(event.eventType)) {
		const sub = event.data as SubscriptionNotification;

		const customUserId = (sub as unknown as { customData?: { userId?: string } }).customData?.userId;
		if (!customUserId) return json({ ok: true });

		const [userRow] = await db
			.select({ id: user.id })
			.from(user)
			.where(eq(user.id, customUserId))
			.limit(1);

		if (!userRow) return json({ ok: true });

		const priceId = sub.items?.[0]?.price?.id ?? '';
		const currentPeriodStart = sub.currentBillingPeriod?.startsAt
			? new Date(sub.currentBillingPeriod.startsAt)
			: new Date();
		const currentPeriodEnd = sub.currentBillingPeriod?.endsAt
			? new Date(sub.currentBillingPeriod.endsAt)
			: new Date();
		const cancelAtPeriodEnd = sub.scheduledChange?.action === 'cancel';
		const canceledAt = sub.canceledAt ? new Date(sub.canceledAt) : null;

		await upsertSubscriptionFromPaddle({
			paddleSubscriptionId: sub.id,
			paddleCustomerId: sub.customerId,
			paddlePriceId: priceId,
			userId: userRow.id,
			status: sub.status as SubscriptionStatus,
			currentPeriodStart,
			currentPeriodEnd,
			cancelAtPeriodEnd,
			canceledAt,
		});
	}

	return json({ ok: true });
};
