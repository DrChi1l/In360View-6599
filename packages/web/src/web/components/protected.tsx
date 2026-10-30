import { Redirect } from "wouter";
import { authClient } from "../lib/auth";
import { Logo } from "./logo";
import { Spinner } from "./empty-state";

function Booting() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <Logo size={26} />
        <Spinner className="text-brand-500" />
      </div>
    </div>
  );
}

/** Gate every app route: unknown session waits, signed-out goes to sign-in. */
export function Protected({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  if (session.isPending) return <Booting />;
  if (!session.data?.user) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

/** The reverse gate, for the sign-in screen itself. */
export function GuestOnly({ children }: { children: React.ReactNode }) {
  const session = authClient.useSession();
  if (session.isPending) return <Booting />;
  if (session.data?.user) return <Redirect to="/" />;
  return <>{children}</>;
}
