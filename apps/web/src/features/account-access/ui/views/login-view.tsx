import { useState } from "react";

import SignInForm from "@/features/account-access/ui/forms/sign-in-form";
import SignUpForm from "@/features/account-access/ui/forms/sign-up-form";

export function LoginView() {
	const [showSignIn, setShowSignIn] = useState(false);

	return showSignIn ? (
		<SignInForm onSwitchToSignUp={() => setShowSignIn(false)} />
	) : (
		<SignUpForm onSwitchToSignIn={() => setShowSignIn(true)} />
	);
}
