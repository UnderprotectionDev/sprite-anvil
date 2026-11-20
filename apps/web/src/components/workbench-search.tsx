import { Button } from "@sprite-anvil/ui/components/button";
import {
	Command,
	CommandDialog,
	CommandInput,
	CommandItem,
	CommandList,
} from "@sprite-anvil/ui/components/command";
import { DialogTrigger } from "@sprite-anvil/ui/components/dialog";
import { createDialogHandle } from "@sprite-anvil/ui/lib/dialog-handle";
import { useForm, useSelector } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useId, useRef } from "react";
import { orpc } from "@/utils/orpc";

export function WorkbenchSearch({ projectId }: { projectId: string }) {
	const triggerId = useId();
	const handleRef = useRef<ReturnType<typeof createDialogHandle>>(null);
	handleRef.current ??= createDialogHandle();
	const handle = handleRef.current;
	const form = useForm({ defaultValues: { name: "" } });
	const name = useSelector(form.store, (state) => state.values.name).trim();
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
				render={<Button variant="outline" />}
			>
				Search Asset Records
			</DialogTrigger>
			<CommandDialog
				description="Search this project's Asset Records by name."
				handle={handle}
				title="Search Asset Records"
			>
				<Command shouldFilter={false}>
					<form.Field name="name">
						{(field) => (
							<CommandInput
								aria-label="Search Asset Records"
								onBlur={field.handleBlur}
								onValueChange={field.handleChange}
								placeholder="Search Asset Records"
								value={field.state.value}
							/>
						)}
					</form.Field>
					<SearchResults
						close={() => handle.close()}
						name={name}
						projectId={projectId}
					/>
					<Link
						onClick={() => handle.close()}
						params={{ projectId }}
						to="/projects/$projectId/assets"
					>
						Open Asset Records
					</Link>
				</Command>
			</CommandDialog>
		</>
	);
}

function SearchResults({
	name,
	projectId,
	close,
}: {
	name: string;
	projectId: string;
	close: () => void;
}) {
	const navigate = useNavigate();
	const query = useQuery({
		...orpc.assetRecords.search.queryOptions({
			input: {
				projectId,
				name: name || undefined,
				pagination: { limit: 20, offset: 0 },
			},
		}),
		enabled: Boolean(name),
		meta: { errorPresentation: "inline" },
	});
	if (name && query.isError) {
		return <p role="alert">Could not search Asset Records.</p>;
	}
	return (
		<CommandList>
			{name
				? query.data?.records.map(({ record }) => (
						<CommandItem
							key={record.id}
							onSelect={() => {
								close();
								void navigate({
									to: "/projects/$projectId/assets/$assetRecordId",
									params: { projectId, assetRecordId: record.id },
								});
							}}
							value={record.id}
						>
							{record.name}
						</CommandItem>
					))
				: null}
		</CommandList>
	);
}
