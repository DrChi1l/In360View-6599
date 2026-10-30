import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { authClient } from "../lib/auth";

/** The signed-in profile row (role, company, phone), or null when signed out. */
export function useMe() {
  const session = authClient.useSession();
  return useQuery(
    orpc.account.me.queryOptions({
      staleTime: 30_000,
      enabled: !session.isPending,
    }),
  );
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.account.updateProfile.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: orpc.account.key() });
        void queryClient.invalidateQueries({ queryKey: orpc.dashboard.key() });
      },
    }),
  );
}
