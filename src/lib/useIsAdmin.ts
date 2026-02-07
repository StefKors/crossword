import { db } from "./db"

/**
 * Check if the current authenticated user has isAdmin === true.
 * Returns { isAdmin, isLoading }.
 * Safe to call unconditionally — returns isAdmin: false if not logged in.
 */
export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
  const { user, isLoading: authLoading } = db.useAuth()

  const { data, isLoading: queryLoading } = db.useQuery(
    user
      ? {
          $users: {
            $: { where: { id: user.id } },
          },
        }
      : null,
  )

  if (authLoading || queryLoading) {
    return { isAdmin: false, isLoading: true }
  }

  const isAdmin = data?.$users?.[0]?.isAdmin === true
  return { isAdmin, isLoading: false }
}
