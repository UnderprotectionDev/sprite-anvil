import { useState } from "react";

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
			<p className="w-32 self-center text-destructive text-sm" role="alert">
				Sürüm {versionNumber} önizlemesi bütünlük doğrulamasından geçemedi.
			</p>
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
