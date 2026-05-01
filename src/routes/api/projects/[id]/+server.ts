import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { db } from '$lib/server/db';
import { userProjects, MAX_PROJECT_BYTES } from '$lib/server/schema';
import { eq, and } from 'drizzle-orm';

async function requireOwnership(request: Request, id: number) {
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
	const id = parseInt(params.id, 10);
	if (isNaN(id)) throw error(400, 'Invalid id');
	const project = await requireOwnership(request, id);
	return json(project);
};

export const PUT: RequestHandler = async ({ request, params }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) throw error(400, 'Invalid id');
	await requireOwnership(request, id);
	const body = await request.json();
	const updates: Partial<typeof userProjects.$inferInsert> = { updatedAt: Date.now() };
	if (body.name !== undefined) updates.name = body.name;
	if (body.project_json !== undefined) {
		if (new TextEncoder().encode(body.project_json).byteLength > MAX_PROJECT_BYTES) {
			throw error(413, 'Project is too large to save. Please delete or resize some images and try again.');
		}
		updates.projectJson = body.project_json;
	}

	await db.update(userProjects).set(updates).where(eq(userProjects.id, id));
	return json({ ok: true });
};

export const DELETE: RequestHandler = async ({ request, params }) => {
	const id = parseInt(params.id, 10);
	if (isNaN(id)) throw error(400, 'Invalid id');
	await requireOwnership(request, id);
	await db.delete(userProjects).where(eq(userProjects.id, id));
	return json({ ok: true });
};
