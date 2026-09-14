import type { LayoutServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { getActiveSubscription, getExportsUsed, toPublicSubscription } from '$lib/server/subscription';
import { FREE_EXPORT_LIMIT, REFUND_WINDOW_DAYS, SUPER_USER_EMAILS } from '$lib/billing-constants';

// Scoped to the (authed) group (app + account) rather than the root layout so it never shares
// a load node with the prerendered (landing) pages. Sharing it with prerendered pages meant the
// session data was baked in at build time (always logged out) and reused as-is by the client
// router when navigating from a landing page into the app, since cookies aren't a tracked
// load dependency — only a hard refresh forced a fresh, request-time session check.
export const load: LayoutServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	const currentUser = session?.user ?? null;

	let subscription = null;
	let exportsRemaining: number | null = null;

	if (currentUser) {
		subscription = await getActiveSubscription(currentUser.id);
		if (!subscription) {
			const used = await getExportsUsed(currentUser.id);
			exportsRemaining = Math.max(0, FREE_EXPORT_LIMIT - used);
		}
	}

	const isSuperUser = SUPER_USER_EMAILS.includes(currentUser?.email ?? '');

	if (isSuperUser) exportsRemaining = null;

	const refundWindowMs = REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
	const refundEligible =
		subscription !== null &&
		!subscription.refundRequestedAt &&
		Date.now() - new Date(subscription.createdAt).getTime() <= refundWindowMs;

	return {
		user: currentUser,
		// Only the session's expiry is safe to expose to the browser — the full row includes
		// `token`, which is the value of the httpOnly session cookie. Serializing it into the
		// page data would let any XSS (or a cached page, or a DOM-capturing tool) steal live
		// sessions, defeating the httpOnly protection entirely. Nothing in the client reads
		// anything else off `session`.
		session: session?.session ? { expiresAt: session.session.expiresAt } : null,
		isSuperUser,
		// Paddle identifiers (subscription/customer/price ids) stay server-side — the UI only
		// needs status/dates, and there's no reason to hand an attacker-readable Paddle
		// subscription id to the browser.
		subscription: subscription ? toPublicSubscription(subscription) : null,
		exportsRemaining,
		refundEligible,
	};
};
