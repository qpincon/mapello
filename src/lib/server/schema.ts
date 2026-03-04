import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const userProjects = sqliteTable('user_projects', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull(),
	name: text('name').notNull(),
	projectJson: text('project_json').notNull(),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull(),
});
