import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import { PUBLIC_PADDLE_CLIENT_TOKEN, PUBLIC_PADDLE_ENV } from '$env/static/public';

let paddle: Paddle | undefined;
let pendingOnComplete: (() => void) | undefined;

export async function loadPaddle(): Promise<Paddle> {
	if (paddle) return paddle;
	paddle = await initializePaddle({
		token: PUBLIC_PADDLE_CLIENT_TOKEN,
		environment: PUBLIC_PADDLE_ENV === 'production' ? 'production' : 'sandbox',
		eventCallback: (event) => {
			if (event.name === 'checkout.completed' && pendingOnComplete) {
				// Delay to give Paddle's webhook time to reach the server and be processed
				setTimeout(() => {
					pendingOnComplete?.();
					pendingOnComplete = undefined;
				}, 3000);
			}
		},
	});
	if (!paddle) throw new Error('Failed to initialize Paddle');
	return paddle;
}

export async function openCheckout(opts: {
	priceId: string;
	userId: string;
	userEmail: string;
	onComplete?: () => void;
}): Promise<void> {
	const p = await loadPaddle();
	pendingOnComplete = opts.onComplete;
	p.Checkout.open({
		items: [{ priceId: opts.priceId, quantity: 1 }],
		customData: { userId: opts.userId },
		customer: { email: opts.userEmail },
		settings: { displayMode: 'overlay' },
	});
}
