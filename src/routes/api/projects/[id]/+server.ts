import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { userProjects } from '$lib/server/schema';
import { eq, and } from 'drizzle-orm';

async function requireOwnership(request: Request, id: string) {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Unauthorized');

	const [project] = await db
		.select()
		.from(userProjects)
		.where(and(eq(userProjects.id, id), eq(userProjects.userId, session.user.id)));

	if (!project) throw error(404, 'Not found');
	return project;
}

export const GET: RequestHandler = async ({ request, params }) => {
	const project = await requireOwnership(request, params.id);
	return json(project);
};

export const PUT: RequestHandler = async ({ request, params }) => {
	await requireOwnership(request, params.id);
	const body = await request.json();
	const updates: Partial<typeof userProjects.$inferInsert> = { updatedAt: Date.now() };
	if (body.name !== undefined) updates.name = body.name;
	if (body.project_json !== undefined) updates.projectJson = body.project_json;

	await db.update(userProjects).set(updates).where(eq(userProjects.id, params.id));
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	await requireOwnership(request, params.id);
	await db.delete(userProjects).where(eq(userProjects.id, params.id));
	return json({ ok: true });
};
