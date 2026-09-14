import type { RequestHandler } from '@sveltejs/kit';
import { error, json } from '@sveltejs/kit';
import { requireUser } from '$lib/server/session';
import { getPaddle } from '$lib/server/paddle';
import { db } from '$lib/server/db';
import { user } from '$lib/server/auth-schema';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ request }) => {
	const authedUser = await requireUser(request);

	const [userRow] = await db
		.select({ paddleCustomerId: user.paddleCustomerId })
		.from(user)
		.where(eq(user.id, authedUser.id))
		.limit(1);

	if (!userRow?.paddleCustomerId) throw error(404, 'No billing account found');

	const paddle = getPaddle();
	const session_ = await paddle.customerPortalSessions.create(userRow.paddleCustomerId, []);

	return json({ url: session_.urls.general.overview });
};
