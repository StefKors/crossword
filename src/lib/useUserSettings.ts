import { useCallback } from "react"
import { id as instantId } from "@instantdb/react"
import { db } from "./db"

export interface UserSettings {
  showTimer: boolean
}

const DEFAULTS: UserSettings = {
  showTimer: false,
}

/**
 * Read and update the current user's settings from InstantDB.
 * Returns defaults when not logged in or settings don't exist yet.
 */
export function useUserSettings(): {
  settings: UserSettings
  isLoading: boolean
  updateSettings: (patch: Partial<UserSettings>) => void
} {
  const { user } = db.useAuth()

  const { data, isLoading } = db.useQuery(
    user
      ? {
          userSettings: {
            $: { where: { "user.id": user.id } },
          },
        }
      : null,
  )

  const existing = data?.userSettings?.[0]

  const settings: UserSettings = {
    showTimer: existing?.showTimer ?? DEFAULTS.showTimer,
  }

  const updateSettings = useCallback(
    (patch: Partial<UserSettings>) => {
      if (!user) return

      const settingsId = existing?.id ?? instantId()

      void db.transact(db.tx.userSettings[settingsId].update(patch).link({ user: user.id }))
    },
    [user, existing?.id],
  )

  return { settings, isLoading, updateSettings }
}
