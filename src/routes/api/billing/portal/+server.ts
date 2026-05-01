import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { getPaddle } from '$lib/server/paddle';
import { db } from '$lib/server/db';
import { user } from '$lib/server/auth-schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Not logged in');

	const [userRow] = await db
		.select({ paddleCustomerId: user.paddleCustomerId })
		.from(user)
		.where(eq(user.id, session.user.id))
		.limit(1);

	if (!userRow?.paddleCustomerId) throw error(404, 'No billing account found');

	const paddle = getPaddle();
	const session_ = await paddle.customerPortalSessions.create(userRow.paddleCustomerId, []);

	return json({ url: session_.urls.general.overview });
};
