import { Button } from "@sprite-anvil/ui/components/button";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@sprite-anvil/ui/components/command";
import { DialogTrigger } from "@sprite-anvil/ui/components/dialog";
import { createDialogHandle } from "@sprite-anvil/ui/lib/dialog-handle";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { orpc } from "@/utils/orpc";

export function WorkspaceSearch() {
	const triggerId = useId();
	const handleRef = useRef<ReturnType<typeof createDialogHandle>>(null);
	handleRef.current ??= createDialogHandle();
	const handle = handleRef.current;
	const navigate = useNavigate();
	const projects = useQuery({
		...orpc.projects.list.queryOptions(),
		meta: { errorPresentation: "inline" },
	});
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				if (handle.isOpen) {
					handle.close();
				} else {
					handle.open(triggerId);
				}
			}
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [handle, triggerId]);
	return (
		<>
			<DialogTrigger
				handle={handle}
				id={triggerId}
				render={
					<Button
						className="border-pixel-edge bg-workbench-preview text-workbench-faint-text ml-auto h-9 w-[280px] min-w-0 justify-start gap-2 rounded-[4px] border px-3 text-[14px] font-normal max-sm:w-auto"
						variant="ghost"
					/>
				}
			>
				<Search className="size-4" />
				<span className="grow text-left max-sm:sr-only">Search, go, run</span>
				<kbd className="bg-workbench-panel text-workbench-muted-text flex h-[22px] min-w-[22px] items-center justify-center rounded-[4px] font-mono text-[12px] leading-[14px] max-sm:hidden">
					⌘
				</kbd>
				<kbd className="bg-workbench-panel text-workbench-muted-text flex h-[22px] min-w-[22px] items-center justify-center rounded-[4px] font-mono text-[12px] leading-[14px] max-sm:hidden">
					K
				</kbd>
			</DialogTrigger>
			<CommandDialog
				description="Find a project or open a workspace screen."
				handle={handle}
				title="Search workspace"
			>
				<Command>
					<CommandInput
						aria-label="Search workspace"
						placeholder="Search, go, run"
					/>
					<CommandList>
						<CommandEmpty>No matching projects or commands.</CommandEmpty>
						<CommandItem
							onSelect={() => {
								handle.close();
								void navigate({ to: "/projects" });
							}}
							value="Projects"
						>
							Projects
						</CommandItem>
						<CommandItem
							onSelect={() => {
								handle.close();
								void navigate({ to: "/project-archives" });
							}}
							value="Project Archive"
						>
							Project Archive
						</CommandItem>
						<CommandItem
							onSelect={() => {
								handle.close();
								void navigate({ to: "/account-settings" });
							}}
							value="Account settings"
						>
							Account settings
						</CommandItem>
						<CommandItem
							onSelect={() => {
								handle.close();
								void navigate({ to: "/context-proposals", search: {} });
							}}
							value="Context Proposals"
						>
							Context Proposals
						</CommandItem>
						<CommandItem
							onSelect={() => {
								handle.close();
								void navigate({ to: "/measurements" });
							}}
							value="Measurements"
						>
							Measurements
						</CommandItem>
						{projects.data?.map((project) => (
							<CommandItem
								key={project.id}
								onSelect={() => {
									handle.close();
									void navigate({
										to: "/projects/$projectId/assets",
										params: { projectId: project.id },
									});
								}}
								value={project.name}
							>
								{project.name}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
}
