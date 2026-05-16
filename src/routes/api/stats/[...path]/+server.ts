import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const UPSTREAM = env.UMAMI_UPSTREAM_URL ?? '';

export const GET: RequestHandler = async ({ params }) => {
	if (!UPSTREAM || params.path !== 's.js') {
		return new Response(null, { status: 204 });
	}
	try {
		const res = await fetch(`${UPSTREAM}/script.js`);
		const body = await res.arrayBuffer();
		return new Response(body, {
			status: 200,
			headers: {
				'Content-Type': 'application/javascript',
				'Cache-Control': 'public, max-age=3600, immutable',
			},
		});
	} catch {
		return new Response(null, { status: 204 });
	}
};

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
	if (!UPSTREAM || params.path !== 'api/send') {
		return new Response(null, { status: 204 });
	}
	try {
		const body = await request.text();
		const res = await fetch(`${UPSTREAM}/api/send`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'User-Agent': request.headers.get('user-agent') ?? '',
				'X-Forwarded-For': getClientAddress(),
			},
			body,
		});
		return new Response(await res.text(), {
			status: res.status,
			headers: { 'Content-Type': res.headers.get('content-type') ?? 'text/plain' },
		});
	} catch {
		return new Response(null, { status: 204 });
	}
};
