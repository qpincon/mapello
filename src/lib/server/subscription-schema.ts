import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { user } from './auth-schema';

export type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled';

export const subscription = sqliteTable('subscription', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	paddleSubscriptionId: text('paddle_subscription_id').notNull().unique(),
	paddleCustomerId: text('paddle_customer_id').notNull(),
	paddlePriceId: text('paddle_price_id').notNull(),
	status: text('status').notNull().$type<SubscriptionStatus>(),
	currentPeriodStart: integer('current_period_start', { mode: 'timestamp_ms' }).notNull(),
	currentPeriodEnd: integer('current_period_end', { mode: 'timestamp_ms' }).notNull(),
	cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
	canceledAt: integer('canceled_at', { mode: 'timestamp_ms' }),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const webhookEvent = sqliteTable('webhook_event', {
	id: text('id').primaryKey(), // Paddle event_id, guaranteed unique
	eventType: text('event_type').notNull(),
	receivedAt: integer('received_at', { mode: 'timestamp_ms' }).notNull(),
	payloadJson: text('payload_json'),
});

export type Subscription = typeof subscription.$inferSelect;

export const subscriptionRelations = relations(subscription, ({ one }) => ({
	user: one(user, {
		fields: [subscription.userId],
		references: [user.id],
	}),
}));
