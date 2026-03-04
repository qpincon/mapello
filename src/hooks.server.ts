import { svelteKitHandler } from 'better-auth/svelte-kit';
import { auth } from '$lib/server/auth';
import { building } from '$app/environment';

export const handle = async ({ event, resolve }) => {
	return svelteKitHandler({ auth, event, resolve, building });
};
