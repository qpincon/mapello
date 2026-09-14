import type { Session, User } from 'better-auth';

declare global {
	interface Window {
		__DEBUG__?: boolean;
	}
	namespace App {
		interface Locals {
			user: User | null;
			session: Session | null;
		}
		interface PageData {
			user: User | null;
			// Narrowed on the server (src/routes/(authed)/+layout.server.ts) — never the full
			// Session, which carries the httpOnly cookie's token value.
			session: { expiresAt: Session['expiresAt'] } | null;
			isSuperUser: boolean;
			subscription: import('$lib/server/subscription-schema').PublicSubscription | null;
			exportsRemaining: number | null;
			refundEligible: boolean;
		}
	}
}

export {};
