// Finish a returning managed sign-in (Google/Apple redirect leg) before the app
// mounts, so the first paint already knows the session. Imported for its side
// effect ahead of the template bootstrap in main.tsx; the top-level await keeps
// the bootstrap from evaluating until the redirect leg has settled.
import { authClient } from "./auth";

try {
  await authClient.managedAuth.handleRedirect();
} catch {
  // A failed/absent redirect must never block the app from booting.
}
