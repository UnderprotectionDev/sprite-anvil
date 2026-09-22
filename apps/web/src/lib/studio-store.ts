import { Store } from "@tanstack/store";

export const studioStore = new Store({ zoom: 16, color: "#242b48" });

export function setZoom(zoom: number) {
	studioStore.setState((state) => ({ ...state, zoom }));
}

export function setColor(color: string) {
	studioStore.setState((state) => ({ ...state, color }));
}
