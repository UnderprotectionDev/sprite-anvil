import type { DeliveryRefreshLock } from "@sprite-anvil/api/delivery-refresh-locks";

/** A Delivery Refresh Lock as the server re-read it: the destination, the exact bundle and the owned paths. */
export function LockPanel({
	heading,
	lock,
}: {
	heading: string;
	lock: DeliveryRefreshLock;
}) {
	return (
		<section
			aria-labelledby={`lock-${lock.id}`}
			className="space-y-2 border-t pt-4"
		>
			<h3 className="font-semibold text-base" id={`lock-${lock.id}`}>
				{heading}
			</h3>
			<dl className="grid grid-cols-[max-content_1fr] gap-x-4 text-sm">
				<dt className="text-muted-foreground">Destination</dt>
				<dd>{lock.destinationLabel}</dd>
				<dt className="text-muted-foreground">Contract version</dt>
				<dd>{lock.contractVersion}</dd>
				<dt className="text-muted-foreground">Profile revision</dt>
				<dd>{lock.profile.revisionNumber}</dd>
				<dt className="text-muted-foreground">Lock digest</dt>
				<dd className="font-mono">{lock.lockDigest.slice(0, 12)}</dd>
			</dl>
			<h4 className="font-medium text-sm">Owned paths ({lock.files.length})</h4>
			<ul aria-label="Owned paths" className="font-mono text-sm">
				{lock.files.map((file) => (
					<li key={file.path}>{file.path}</li>
				))}
			</ul>
		</section>
	);
}
