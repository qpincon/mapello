import type { LayoutServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { getActiveSubscription, getExportsUsed } from '$lib/server/subscription';
import { FREE_EXPORT_LIMIT, REFUND_WINDOW_DAYS, SUPER_USER_EMAILS } from '$lib/billing-constants';

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
		session: session?.session ?? null,
		isSuperUser,
		subscription,
		exportsRemaining,
		refundEligible,
	};
};
