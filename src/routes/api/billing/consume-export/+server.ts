import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/session';
import { consumeExport } from '$lib/server/subscription';
import { SUPER_USER_EMAILS } from '$lib/billing-constants';

export const POST: RequestHandler = async ({ request }) => {
	const user = await requireUser(request);

	if (SUPER_USER_EMAILS.includes(user.email)) {
		return json({ remaining: -1 });
	}

	const result = await consumeExport(user.id);

	if (!result.allowed) {
		throw error(403, JSON.stringify({ remaining: 0 }));
	}

	return json({ remaining: result.remaining });
};
