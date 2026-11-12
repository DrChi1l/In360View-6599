import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "../../api";
import { authConfigured, supabase } from "./auth";

const link = new RPCLink({
  url: `${window.location.origin}/api/rpc`,
  // The server verifies this token on every request; no cookie is involved.
  headers: async (): Promise<Record<string, string>> => {
    if (!authConfigured) return {};
    const { data } = await supabase.auth.getSession();
    return data.session ? { authorization: `Bearer ${data.session.access_token}` } : {};
  },
});

/** Direct typed client: await client.ping() */
export const client: AppRouterClient = createORPCClient(link);

/** TanStack Query helpers: useQuery(orpc.ping.queryOptions()) */
export const orpc = createTanstackQueryUtils(client);
