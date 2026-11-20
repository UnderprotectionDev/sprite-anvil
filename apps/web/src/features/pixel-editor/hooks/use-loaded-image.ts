import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useEffect } from "react";

interface ImageLoadState {
	failedUrl: string | null;
	loaded: { image: HTMLImageElement; url: string } | null;
}

/** Loads a credentialed image so its pixels can be drawn and read on a canvas. */
export function useLoadedImage(url: string | null) {
	const imageLoad = useCreateStore<ImageLoadState>({
		failedUrl: null,
		loaded: null,
	});
	const { failedUrl, loaded } = useSelector(imageLoad, (state) => state);

	useEffect(() => {
		if (!url) {
			return;
		}
		const image = new Image();
		image.crossOrigin = "use-credentials";
		image.onload = () => {
			imageLoad.setState(() => ({ failedUrl: null, loaded: { image, url } }));
		};
		image.onerror = () => {
			imageLoad.setState((state) => ({ ...state, failedUrl: url }));
		};
		image.src = url;
		return () => {
			image.onload = null;
			image.onerror = null;
		};
	}, [imageLoad, url]);

	return {
		// Keep the previous frame on screen until the next revision has loaded.
		image: loaded?.image ?? null,
		isCurrent: loaded?.url === url,
		failed: url !== null && failedUrl === url,
	};
}
