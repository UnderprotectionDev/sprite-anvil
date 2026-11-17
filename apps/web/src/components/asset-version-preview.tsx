import { useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { client } from "@/utils/orpc";

export function AssetVersionPreview({
	recordName,
	projectId,
	assetVersionId,
	url,
	versionNumber,
}: {
	recordName: string;
	projectId?: string;
	assetVersionId?: string;
	url: string;
	versionNumber: number;
}) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return (
			<StatusMessage className="w-32 self-center" tone="error">
				Version {versionNumber} preview failed integrity verification.
			</StatusMessage>
		);
	}
	return (
		<>
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Image load failures switch to the accessible error message above. */}
			<img
				alt={`${recordName}, Version ${versionNumber} preview`}
				className="aspect-square w-32 rounded border bg-muted object-contain"
				crossOrigin="use-credentials"
				height={128}
				loading="lazy"
				onError={() => setFailed(true)}
				onLoad={() => {
					if (projectId && assetVersionId && navigator.onLine) {
						void client.measurementEvents
							.recordCandidatePreviewBoundary({ projectId, assetVersionId })
							.catch(() => {
								// Measurement must not affect the preview.
							});
					}
				}}
				src={url}
				width={128}
			/>
		</>
	);
}
