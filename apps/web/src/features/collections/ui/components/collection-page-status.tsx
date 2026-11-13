import { Button } from "@sprite-anvil/ui/components/button";
import { StatusMessage } from "@/components/status-message";

export function CollectionPageStatus({
	catalogError,
	catalogPending,
	isCheckingOutcome,
	onCheckOutcome,
	onRetry,
	projectMissing,
	projectsPending,
	statusMessage,
	writeOutcomeUncertain,
}: {
	catalogError: boolean;
	catalogPending: boolean;
	isCheckingOutcome: boolean;
	onCheckOutcome: () => void;
	onRetry: () => void;
	projectMissing: boolean;
	projectsPending: boolean;
	statusMessage: string | null;
	writeOutcomeUncertain: boolean;
}) {
	return (
		<div className="space-y-3">
			{projectMissing ? (
				<StatusMessage tone="error">Bu Proje bulunamadı.</StatusMessage>
			) : null}
			{projectsPending ? (
				<p aria-live="polite" role="status">
					Projeler yükleniyor…
				</p>
			) : null}
			{catalogPending ? (
				<p aria-live="polite" role="status">
					Koleksiyonlar yükleniyor…
				</p>
			) : null}
			{catalogError ? (
				<div className="space-y-2">
					<StatusMessage tone="error">Koleksiyonlar yüklenemedi.</StatusMessage>
					<Button
						className="min-h-11"
						onClick={onRetry}
						type="button"
						variant="outline"
					>
						Yeniden dene
					</Button>
				</div>
			) : null}
			{statusMessage ? (
				<p aria-live="polite" role="status">
					{statusMessage}
				</p>
			) : null}
			{writeOutcomeUncertain ? (
				<Button
					className="min-h-11"
					disabled={isCheckingOutcome}
					onClick={onCheckOutcome}
					type="button"
					variant="outline"
				>
					{isCheckingOutcome ? "Durum kontrol ediliyor…" : "Durumu kontrol et"}
				</Button>
			) : null}
		</div>
	);
}
