import { useState } from "react";
import { StatusMessage } from "@/components/status-message";

export function AssetVersionPreview({
	recordName,
	url,
	versionNumber,
}: {
	recordName: string;
	url: string;
	versionNumber: number;
}) {
	const [failed, setFailed] = useState(false);
	if (failed) {
		return (
			<StatusMessage className="w-32 self-center" tone="error">
				Sürüm {versionNumber} önizlemesi bütünlük doğrulamasından geçemedi.
			</StatusMessage>
		);
	}
	return (
		<>
			{/* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Image load failures switch to the accessible error message above. */}
			<img
				alt={`${recordName}, Sürüm ${versionNumber} önizlemesi`}
				className="aspect-square w-32 rounded border bg-muted object-contain"
				crossOrigin="use-credentials"
				height={128}
				loading="lazy"
				onError={() => setFailed(true)}
				src={url}
				width={128}
			/>
		</>
	);
}
