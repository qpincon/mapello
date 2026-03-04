import { auth } from '$lib/server/auth';
import { toSvelteKitHandler } from 'better-auth/svelte-kit';

export const { GET, POST } = {
	GET: toSvelteKitHandler(auth),
	POST: toSvelteKitHandler(auth),
};
