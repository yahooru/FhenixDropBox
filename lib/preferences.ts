import { CONTRACT_ADDRESS } from "@/lib/fhenix"

export interface AppPreferences {
  hideFiles: boolean
  privateAnalytics: boolean
  anonymousUploads: boolean
  downloadAlerts: boolean
  purchaseAlerts: boolean
  weeklySummary: boolean
  defaultPrice: string
  defaultDownloads: string
  defaultExpiry: string
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  hideFiles: true,
  privateAnalytics: true,
  anonymousUploads: false,
  downloadAlerts: true,
  purchaseAlerts: true,
  weeklySummary: false,
  defaultPrice: "0",
  defaultDownloads: "100",
  defaultExpiry: "7",
}

function preferencesKey(owner: string) {
  return `fdb:preferences:${CONTRACT_ADDRESS.toLowerCase()}:${owner.toLowerCase()}`
}

export function getPreferences(owner: string | undefined): AppPreferences {
  if (typeof window === "undefined" || !owner) return DEFAULT_PREFERENCES

  try {
    const raw = window.localStorage.getItem(preferencesKey(owner))
    if (!raw) return DEFAULT_PREFERENCES

    return {
      ...DEFAULT_PREFERENCES,
      ...JSON.parse(raw),
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(owner: string | undefined, preferences: AppPreferences) {
  if (typeof window === "undefined" || !owner) return
  window.localStorage.setItem(preferencesKey(owner), JSON.stringify(preferences))
}
