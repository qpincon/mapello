import type { LayoutServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { getActiveSubscription } from '$lib/server/subscription';
import { db } from '$lib/server/db';
import { user } from '$lib/server/auth-schema';
import { eq } from 'drizzle-orm';
import { FREE_EXPORT_LIMIT } from '$lib/billing-constants';

export const load: LayoutServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	const currentUser = session?.user ?? null;

	let subscription = null;
	let exportCount = 0;
	let exportsRemaining: number | null = null;

	if (currentUser) {
		const [userRow] = await db
			.select({ exportCount: user.exportCount })
			.from(user)
			.where(eq(user.id, currentUser.id))
			.limit(1);

		exportCount = userRow?.exportCount ?? 0;
		subscription = await getActiveSubscription(currentUser.id);
		exportsRemaining = subscription ? null : Math.max(0, FREE_EXPORT_LIMIT - exportCount);
	}

	return {
		user: currentUser,
		session: session?.session ?? null,
		isSuperUser: currentUser?.email === 'pinconquentin@gmail.com',
		subscription,
		exportsRemaining,
	};
};
