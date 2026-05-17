export function log(...args: unknown[]): void {
	if (typeof window !== 'undefined' && window.__DEBUG__) {
		console.log(...args);
	}
}

export function logTime(label: string): void {
	if (typeof window !== 'undefined' && window.__DEBUG__) {
		console.time(label);
	}
}

export function logTimeEnd(label: string): void {
	if (typeof window !== 'undefined' && window.__DEBUG__) {
		console.timeEnd(label);
	}
}
