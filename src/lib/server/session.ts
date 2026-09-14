import { error } from '@sveltejs/kit';
import { auth } from './auth';
import type { User } from 'better-auth';

// Shared by every authenticated API route (projects, billing, feedback, account) so the
// session check lives in one place instead of being re-implemented per endpoint.
export async function requireUser(request: Request): Promise<User> {
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) throw error(401, 'Unauthorized');
	return session.user;
}
