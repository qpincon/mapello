import type { LayoutServerLoad } from './$types';
import { auth } from '$lib/server/auth';

export const load: LayoutServerLoad = async ({ request }) => {
	const session = await auth.api.getSession({ headers: request.headers });
	const user = session?.user ?? null;
	return {
		user,
		session: session?.session ?? null,
		isSuperUser: user?.email === 'pinconquentin@gmail.com',
	};
};
