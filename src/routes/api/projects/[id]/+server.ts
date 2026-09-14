import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { requireUser } from '$lib/server/session';
import { db } from '$lib/server/db';
import { userProjects, validProjectName, validProjectJson } from '$lib/server/schema';
import { eq, and } from 'drizzle-orm';

async function requireOwnership(request: Request, id: number) {
	const user = await requireUser(request);

	const [project] = await db
		.select()
		.from(userProjects)
		.where(and(eq(userProjects.id, id), eq(userProjects.userId, user.id)));

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
	if (body.name === undefined && body.project_json === undefined) {
		throw error(400, 'Nothing to update — provide name and/or project_json');
	}
	const updates: Partial<typeof userProjects.$inferInsert> = { updatedAt: Date.now() };
	if (body.name !== undefined) updates.name = validProjectName(body.name);
	if (body.project_json !== undefined) updates.projectJson = validProjectJson(body.project_json);

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
