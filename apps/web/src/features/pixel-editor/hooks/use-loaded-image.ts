import { useEffect, useState } from "react";

/** Loads a credentialed image so its pixels can be drawn and read on a canvas. */
export function useLoadedImage(url: string | null) {
	const [loaded, setLoaded] = useState<{
		image: HTMLImageElement;
		url: string;
	} | null>(null);
	const [failedUrl, setFailedUrl] = useState<string | null>(null);

	useEffect(() => {
		if (!url) {
			return;
		}
		let cancelled = false;
		const image = new Image();
		image.crossOrigin = "use-credentials";
		image.onload = () => {
			if (!cancelled) {
				setLoaded({ image, url });
			}
		};
		image.onerror = () => {
			if (!cancelled) {
				setFailedUrl(url);
			}
		};
		image.src = url;
		return () => {
			cancelled = true;
		};
	}, [url]);

	return {
		// Keep the previous frame on screen until the next revision has loaded.
		image: loaded?.image ?? null,
		isCurrent: loaded?.url === url,
		failed: failedUrl === url,
	};
}
