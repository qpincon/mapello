import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { userProjects } from '$lib/server/schema';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function requireUser(request: Request) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Unauthorized');
	return session.user;
}

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
	const { name, project_json } = body;
	if (!name || !project_json) throw error(400, 'Missing name or project_json');

	const now = Date.now();
	const id = randomUUID();
	await db.insert(userProjects).values({
		id,
		userId: user.id,
		name,
		projectJson: project_json,
		createdAt: now,
		updatedAt: now,
	});

	return json({ id, name, createdAt: now, updatedAt: now }, { status: 201 });
};
