type Props = Record<string, string | number | boolean>;

export function track(event: string, props?: Props): void {
	if (typeof window === 'undefined') return;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const w = window as any;
	if (w.umami?.track) w.umami.track(event, props);
}
