import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { consumeExport } from '$lib/server/subscription';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not logged in');

	const result = await consumeExport(session.user.id);

	if (!result.allowed) {
		throw error(403, JSON.stringify({ remaining: 0 }));
	}

	return json({ remaining: result.remaining });
};
