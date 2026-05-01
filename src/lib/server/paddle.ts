import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export function getPaddle(): Paddle {
	const apiKey = privateEnv.PADDLE_API_KEY;
	if (!apiKey) throw new Error('PADDLE_API_KEY is not set');
	const environment = publicEnv.PUBLIC_PADDLE_ENV === 'production' ? Environment.production : Environment.sandbox;
	return new Paddle(apiKey, { environment });
}

export function getWebhookSecret(): string {
	const secret = privateEnv.PADDLE_WEBHOOK_SECRET;
	if (!secret) throw new Error('PADDLE_WEBHOOK_SECRET is not set');
	return secret;
}
