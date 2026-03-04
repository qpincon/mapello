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
		}
	}
}

export {};
