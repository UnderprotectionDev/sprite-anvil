import { Button } from "@sprite-anvil/ui/components/button";
import {
	Command,
	CommandDialog,
	CommandInput,
	CommandItem,
	CommandList,
} from "@sprite-anvil/ui/components/command";
import { useForm, useSelector } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { orpc } from "@/utils/orpc";

export function WorkbenchSearch({ projectId }: { projectId: string }) {
	const [open, setOpen] = useState(false);
	const navigate = useNavigate();
	const form = useForm({ defaultValues: { name: "" } });
	const name = useSelector(form.store, (state) => state.values.name).trim();
	const query = useQuery({
		...orpc.assetRecords.search.queryOptions({
			input: {
				projectId,
				name: name || undefined,
				pagination: { limit: 20, offset: 0 },
			},
		}),
		enabled: open && Boolean(name),
		meta: { errorPresentation: "inline" },
	});
	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((value) => !value);
			}
		}
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, []);
	return (
		<>
			<Button onClick={() => setOpen(true)} variant="outline">
				Search Asset Records
			</Button>
			<CommandDialog
				description="Search this project's Asset Records by name."
				onOpenChange={setOpen}
				open={open}
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
					{name && query.isError ? (
						<p role="alert">Could not search Asset Records.</p>
					) : null}
					<CommandList>
						{name && !query.isError
							? query.data?.records.map(({ record }) => (
									<CommandItem
										key={record.id}
										onSelect={() => {
											setOpen(false);
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
					<Link
						onClick={() => setOpen(false)}
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
