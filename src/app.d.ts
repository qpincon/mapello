import type { Session, User } from 'better-auth';

declare global {
	namespace App {
		interface Locals {
			user: User | null;
			session: Session | null;
		}
		interface PageData {
			user: User | null;
			session: Session | null;
			isSuperUser: boolean;
			subscription: import('$lib/server/subscription-schema').Subscription | null;
			exportsRemaining: number | null;
		}
	}
}

export {};
