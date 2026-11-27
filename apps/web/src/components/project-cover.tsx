import { cn } from "@sprite-anvil/ui/lib/utils";
import { ImageIcon } from "lucide-react";
import { useState } from "react";
import type { ProjectCoverRecord } from "@/utils/project-cover";
import { projectCoverUrl } from "@/utils/project-cover";

export function ProjectCover({
	project,
	className = "",
	framed = false,
}: {
	project: ProjectCoverRecord;
	className?: string;
	framed?: boolean;
}) {
	const [failedId, setFailedId] = useState<string>();
	const url = projectCoverUrl(project);
	return (
		<div
			className={cn(
				"rounded-tag bg-workbench-scene relative isolate overflow-hidden",
				className
			)}
		>
			{url && url !== failedId ? (
				// biome-ignore lint/a11y/noNoninteractiveElementInteractions: The fallback represents an unavailable image.
				<img
					alt={`${project.name} project preview`}
					className="absolute inset-0 size-full object-cover object-[50%_40%] [image-rendering:pixelated]"
					crossOrigin="use-credentials"
					height={900}
					onError={() => setFailedId(url)}
					src={url}
					width={1440}
				/>
			) : (
				<div
					aria-hidden="true"
					className="text-workbench-faint-text absolute inset-0 flex items-center justify-center"
				>
					<ImageIcon className="size-10" />
				</div>
			)}
			{framed ? (
				<div
					aria-hidden="true"
					className="pointer-events-none absolute inset-4"
				>
					<span className="border-workbench-text/75 absolute top-0 left-0 size-3.5 border-t-2 border-l-2" />
					<span className="border-workbench-text/75 absolute top-0 right-0 size-3.5 border-t-2 border-r-2" />
					<span className="border-workbench-text/75 absolute bottom-0 left-0 size-3.5 border-b-2 border-l-2" />
					<span className="border-workbench-text/75 absolute right-0 bottom-0 size-3.5 border-r-2 border-b-2" />
				</div>
			) : null}
		</div>
	);
}
