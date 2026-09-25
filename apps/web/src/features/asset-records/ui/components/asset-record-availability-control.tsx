import type {
	AssetRecord,
	MutableAssetRecordAvailability,
} from "@sprite-anvil/api/asset-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

interface AvailabilityRefreshResult {
	data?: AssetRecord;
	isError: boolean;
}

const availabilityLabels: Record<AssetRecord["availability"], string> = {
	active: "Etkin",
	archived: "Arşivlenmiş",
	erased: "Silinmiş",
};

export function getAvailabilityLabel(
	availability: AssetRecord["availability"]
) {
	return availabilityLabels[availability];
}

function getAvailabilityMessage(
	currentAvailability: AssetRecord["availability"],
	expectedAvailability: MutableAssetRecordAvailability
) {
	if (currentAvailability !== expectedAvailability) {
		return `Güncel kayıt durumu: ${getAvailabilityLabel(currentAvailability)}.`;
	}
	if (expectedAvailability === "archived") {
		return "Kayıt arşivlendi.";
	}
	return "Kayıt yeniden etkinleştirildi.";
}

export function AssetRecordAvailabilityControl({
	onRefresh,
	record,
}: {
	onRefresh: () => Promise<AvailabilityRefreshResult>;
	record: AssetRecord;
}) {
	const queryClient = useQueryClient();
	const recordsQueryOptions = orpc.assetRecords.list.queryOptions({
		input: { projectId: record.projectId },
	});
	const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
	const [pendingAvailability, setPendingAvailability] =
		useState<MutableAssetRecordAvailability | null>(null);
	const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
	const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(
		null
	);

	async function updateAvailability(
		availability: MutableAssetRecordAvailability
	) {
		if (record.availability === "erased" || pendingAvailability) {
			return;
		}

		setIsUpdatingAvailability(true);
		setAvailabilityMessage(null);
		try {
			const input = { assetRecordId: record.id, projectId: record.projectId };
			if (availability === "archived") {
				await client.assetRecords.archive(input);
			} else {
				await client.assetRecords.restore(input);
			}
			void queryClient.invalidateQueries({
				queryKey: recordsQueryOptions.queryKey,
			});
			const result = await onRefresh();
			if (result.isError || !result.data) {
				setPendingAvailability(availability);
				if (!result.isError) {
					toast.error(
						"İşlem tamamlandı ancak güncel kayıt durumu doğrulanamadı. Mevcut durumu kontrol edin."
					);
				}
				return;
			}
			setAvailabilityMessage(
				getAvailabilityMessage(result.data.availability, availability)
			);
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setPendingAvailability(availability);
			}
			toast.error(
				getErrorMessage(
					error,
					"Kayıt durumu doğrulanamadı. Mevcut durumu kontrol edin."
				)
			);
		} finally {
			setIsUpdatingAvailability(false);
		}
	}

	async function checkAvailabilityOutcome() {
		if (!pendingAvailability) {
			return;
		}

		setIsCheckingAvailability(true);
		try {
			const result = await onRefresh();
			if (result.isError || !result.data) {
				if (!result.isError) {
					toast.error("Güncel kayıt durumu okunamadı. Yeniden deneyin.");
				}
				return;
			}

			const { availability } = result.data;
			setPendingAvailability(null);
			setAvailabilityMessage(
				getAvailabilityMessage(availability, pendingAvailability)
			);
			await queryClient.invalidateQueries({
				queryKey: recordsQueryOptions.queryKey,
			});
		} finally {
			setIsCheckingAvailability(false);
		}
	}

	return (
		<section
			aria-labelledby="record-availability"
			className="rounded-lg border p-5"
		>
			<h2 className="font-semibold" id="record-availability">
				Kayıt durumu
			</h2>
			<p className="mt-1">{getAvailabilityLabel(record.availability)}</p>
			{record.availability === "active" ? (
				<Button
					className="mt-3"
					disabled={isUpdatingAvailability || pendingAvailability !== null}
					onClick={() => void updateAvailability("archived")}
					type="button"
					variant="outline"
				>
					{isUpdatingAvailability ? "Güncelleniyor…" : "Kaydı arşivle"}
				</Button>
			) : null}
			{record.availability === "archived" ? (
				<Button
					className="mt-3"
					disabled={isUpdatingAvailability || pendingAvailability !== null}
					onClick={() => void updateAvailability("active")}
					type="button"
					variant="outline"
				>
					{isUpdatingAvailability
						? "Güncelleniyor…"
						: "Kaydı yeniden etkinleştir"}
				</Button>
			) : null}
			{pendingAvailability ? (
				<Button
					className="mt-3"
					disabled={isCheckingAvailability}
					onClick={() => void checkAvailabilityOutcome()}
					type="button"
					variant="outline"
				>
					{isCheckingAvailability
						? "Durum kontrol ediliyor…"
						: "Durumu kontrol et"}
				</Button>
			) : null}
			{availabilityMessage ? (
				<p aria-live="polite" className="mt-3" role="status">
					{availabilityMessage}
				</p>
			) : null}
			<p className="mt-2 text-muted-foreground text-sm">
				Genel Varlık Desteği · Özel profil kanıtı yok
			</p>
			<p className="mt-2 text-muted-foreground text-sm">
				Kayıt oluşturuldu ·{" "}
				<time dateTime={record.createdAt}>
					{new Intl.DateTimeFormat("tr-TR", {
						dateStyle: "medium",
						timeStyle: "short",
					}).format(new Date(record.createdAt))}
				</time>
			</p>
		</section>
	);
}
