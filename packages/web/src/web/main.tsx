// Entry point referenced by index.html — composition only, real bootstrap
// lives in __main.tsx (template-managed).
// auth-redirect settles a returning managed sign-in first (top-level await), so
// the bootstrap below only evaluates once the session is known.
import "./lib/auth-redirect";
import "./__main";
