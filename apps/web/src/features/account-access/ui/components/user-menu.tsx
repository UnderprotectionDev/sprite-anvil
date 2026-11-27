import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@sprite-anvil/ui/components/avatar";
import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@sprite-anvil/ui/components/dropdown-menu";
import { Skeleton } from "@sprite-anvil/ui/components/skeleton";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { resetSessionQueryClient } from "@/utils/query-client";

export default function UserMenu() {
	const navigate = useNavigate();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <Skeleton className="h-9 w-24" />;
	}

	if (!session) {
		return (
			<Link className={buttonVariants({ variant: "outline" })} to="/login">
				Sign In
			</Link>
		);
	}

	function signOut() {
		void authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					resetSessionQueryClient();
					navigate({ to: "/login" });
				},
			},
		});
	}
	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						className="h-auto min-w-0 flex-1 justify-start gap-2 px-2 py-2"
						variant="ghost"
					/>
				}
			>
				<Avatar className="rounded-full">
					{session.user.image ? (
						<AvatarImage alt="" src={session.user.image} />
					) : null}
					<AvatarFallback>
						{session.user.name.slice(0, 2).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<span className="min-w-0 flex-1 text-left">
					<span className="block truncate">{session.user.name}</span>
					<span className="text-label text-workbench-faint-text block font-normal">
						Signed in · Email
					</span>
				</span>
				<ChevronsUpDown className="text-workbench-faint-text size-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent className="bg-card">
				<DropdownMenuGroup>
					<DropdownMenuLabel>My Account</DropdownMenuLabel>
					<DropdownMenuSeparator />
					<DropdownMenuItem render={<Link to="/account-settings" />}>
						Account settings
					</DropdownMenuItem>
					<DropdownMenuItem onClick={signOut} variant="destructive">
						Sign Out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
