import type { LayoutServerLoad } from './$types';
import { auth } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	return {
		user: session?.user ?? null,
		session: session?.session ?? null,
	};
};
