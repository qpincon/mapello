import { eq, and, gt, inArray } from 'drizzle-orm';
import { db } from './db';
import { subscription, webhookEvent, type SubscriptionStatus } from './subscription-schema';
import { user } from './auth-schema';
import { FREE_EXPORT_LIMIT } from '$lib/billing-constants';

export async function getActiveSubscription(userId: string) {
	const now = new Date();
	const rows = await db
		.select()
		.from(subscription)
		.where(
			and(
				eq(subscription.userId, userId),
				inArray(subscription.status, ['active', 'trialing'] as SubscriptionStatus[]),
				gt(subscription.currentPeriodEnd, now),
			),
		)
		.limit(1);
	return rows[0] ?? null;
}

export async function isPro(userId: string): Promise<boolean> {
	const sub = await getActiveSubscription(userId);
	return sub !== null;
}

export function currentExportPeriod(now = new Date()): string {
	const y = now.getUTCFullYear();
	const m = String(now.getUTCMonth() + 1).padStart(2, "0");
	return `${y}-${m}`;
}

// Read-only "how many exports used in the current month" (0 if the quota window rolled over)
export async function getExportsUsed(userId: string): Promise<number> {
	const [row] = await db
		.select({ exportCount: user.exportCount, exportPeriod: user.exportPeriod })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);

	if (!row) return 0;
	return row.exportPeriod === currentExportPeriod() ? row.exportCount : 0;
}

export async function consumeExport(userId: string): Promise<{ allowed: boolean; remaining: number }> {
	if (await isPro(userId)) {
		return { allowed: true, remaining: -1 }; // -1 = unlimited
	}

	// Transaction ensures the read-check-increment is atomic in SQLite
	return db.transaction((tx) => {
		const [current] = tx
			.select({ exportCount: user.exportCount, exportPeriod: user.exportPeriod })
			.from(user)
			.where(eq(user.id, userId))
			.limit(1)
			.all();

		if (!current) return { allowed: false, remaining: 0 };

		const period = currentExportPeriod();
		const used = current.exportPeriod === period ? current.exportCount : 0; // month rollover → reset

		if (used >= FREE_EXPORT_LIMIT) {
			return { allowed: false, remaining: 0 };
		}

		const newCount = used + 1;
		tx.update(user)
			.set({ exportCount: newCount, exportPeriod: period })
			.where(eq(user.id, userId))
			.run();

		return { allowed: true, remaining: FREE_EXPORT_LIMIT - newCount };
	});
}

export async function upsertSubscriptionFromPaddle(payload: {
	paddleSubscriptionId: string;
	paddleCustomerId: string;
	paddlePriceId: string;
	userId: string;
	status: SubscriptionStatus;
	currentPeriodStart: Date;
	currentPeriodEnd: Date;
	cancelAtPeriodEnd: boolean;
	canceledAt: Date | null;
}) {
	const now = new Date();
	const existing = await db
		.select({ id: subscription.id })
		.from(subscription)
		.where(eq(subscription.paddleSubscriptionId, payload.paddleSubscriptionId))
		.limit(1);

	if (existing.length > 0) {
		await db
			.update(subscription)
			.set({
				paddlePriceId: payload.paddlePriceId,
				status: payload.status,
				currentPeriodStart: payload.currentPeriodStart,
				currentPeriodEnd: payload.currentPeriodEnd,
				cancelAtPeriodEnd: payload.cancelAtPeriodEnd,
				canceledAt: payload.canceledAt,
				updatedAt: now,
			})
			.where(eq(subscription.paddleSubscriptionId, payload.paddleSubscriptionId));
	} else {
		await db.insert(subscription).values({
			userId: payload.userId,
			paddleSubscriptionId: payload.paddleSubscriptionId,
			paddleCustomerId: payload.paddleCustomerId,
			paddlePriceId: payload.paddlePriceId,
			status: payload.status,
			currentPeriodStart: payload.currentPeriodStart,
			currentPeriodEnd: payload.currentPeriodEnd,
			cancelAtPeriodEnd: payload.cancelAtPeriodEnd,
			canceledAt: payload.canceledAt,
			createdAt: now,
			updatedAt: now,
		});
	}

	// Store paddle_customer_id on user if not already set
	await db
		.update(user)
		.set({ paddleCustomerId: payload.paddleCustomerId })
		.where(eq(user.id, payload.userId));
}

export async function isWebhookEventProcessed(eventId: string): Promise<boolean> {
	const rows = await db
		.select({ id: webhookEvent.id })
		.from(webhookEvent)
		.where(eq(webhookEvent.id, eventId))
		.limit(1);
	return rows.length > 0;
}

export async function recordWebhookEvent(eventId: string, eventType: string, payloadJson: string) {
	await db.insert(webhookEvent).values({
		id: eventId,
		eventType,
		receivedAt: new Date(),
		payloadJson,
	});
}
