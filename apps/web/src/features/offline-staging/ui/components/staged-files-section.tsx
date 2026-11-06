import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import type { ChangeEvent } from "react";
import type { StagedFileRow } from "../../lib/offline-staging-store";

/** PNG files staged in this browser, waiting for the Import Inbox. */
export function StagedFilesSection({
	canSend,
	files,
	message,
	onRemove,
	onSend,
	onStage,
}: {
	canSend: boolean;
	files: StagedFileRow[];
	message: string | null;
	onRemove: (id: string) => void;
	onSend: () => void;
	onStage: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
	return (
		<section aria-labelledby="offline-files" className="space-y-3">
			<h2 className="font-medium text-lg" id="offline-files">
				Staged files
			</h2>
			<div className="space-y-2">
				<Label htmlFor="offline-file-input">Stage a PNG file</Label>
				<Input
					accept="image/png"
					id="offline-file-input"
					onChange={onStage}
					type="file"
				/>
			</div>
			{message ? <p role="status">{message}</p> : null}
			{files.length === 0 ? (
				<p className="text-muted-foreground text-sm">No staged files.</p>
			) : (
				<ul className="space-y-2">
					{files.map((file) => (
						<li
							className="flex flex-wrap items-center gap-3 rounded-md border p-3"
							key={file.id}
						>
							<span className="min-w-0 break-all">{file.name}</span>
							<span className="text-muted-foreground text-sm">
								{file.size} bytes, waiting for the Import Inbox
							</span>
							<Button
								aria-label={`Remove ${file.name} from staging`}
								onClick={() => onRemove(file.id)}
								type="button"
								variant="outline"
							>
								Remove
							</Button>
						</li>
					))}
				</ul>
			)}
			<Button disabled={!canSend} onClick={onSend} type="button">
				Send staged files to the Import Inbox
			</Button>
		</section>
	);
}
