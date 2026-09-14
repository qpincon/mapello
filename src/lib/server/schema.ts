import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { error } from '@sveltejs/kit';

export const MAX_PROJECT_BYTES = 1_000_000;
export const MAX_PROJECT_NAME_LENGTH = 200;

// Shared by the projects POST/PUT handlers so both reject malformed input the same way instead
// of trusting body.name / body.project_json to already be the right type.
export function validProjectName(v: unknown): string {
	if (typeof v !== 'string') throw error(400, 'name must be a string');
	const name = v.trim();
	if (!name) throw error(400, 'name is required');
	if (name.length > MAX_PROJECT_NAME_LENGTH) {
		throw error(400, `name is too long (max ${MAX_PROJECT_NAME_LENGTH} characters)`);
	}
	return name;
}

export function validProjectJson(v: unknown): string {
	if (typeof v !== 'string') throw error(400, 'project_json must be a string');
	if (new TextEncoder().encode(v).byteLength > MAX_PROJECT_BYTES) {
		throw error(413, 'Project is too large to save. Please delete or resize some images and try again.');
	}
	return v;
}

export const userProjects = sqliteTable('user_projects', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	userId: text('user_id').notNull(),
	name: text('name').notNull(),
	projectJson: text('project_json').notNull(),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull(),
});
