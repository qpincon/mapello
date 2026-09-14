import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/session';
import { db } from '$lib/server/db';
import { userProjects, validProjectName, validProjectJson } from '$lib/server/schema';
import { isPro } from '$lib/server/subscription';
import { FREE_PROJECT_LIMIT, PRO_PROJECT_LIMIT } from '$lib/billing-constants';
import { eq, desc, count } from 'drizzle-orm';

export const GET: RequestHandler = async ({ request }) => {
	const user = await requireUser(request);
	const projects = await db
		.select({
			id: userProjects.id,
			name: userProjects.name,
			createdAt: userProjects.createdAt,
			updatedAt: userProjects.updatedAt,
		})
		.from(userProjects)
		.where(eq(userProjects.userId, user.id))
		.orderBy(desc(userProjects.updatedAt));
	return json(projects);
};

export const POST: RequestHandler = async ({ request }) => {
	const user = await requireUser(request);
	const body = await request.json();
	const name = validProjectName(body.name);
	const projectJson = validProjectJson(body.project_json);

	const [{ total }] = await db.select({ total: count() }).from(userProjects).where(eq(userProjects.userId, user.id));
	const limit = (await isPro(user.id)) ? PRO_PROJECT_LIMIT : FREE_PROJECT_LIMIT;
	if (total >= limit) {
		throw error(403, `Project limit reached (maximum ${limit})`);
	}

	const now = Date.now();
	const [created] = await db.insert(userProjects).values({
		userId: user.id,
		name,
		projectJson,
		createdAt: now,
		updatedAt: now,
	}).returning({ id: userProjects.id });

	return json({ id: created.id, name, createdAt: now, updatedAt: now }, { status: 201 });
};
