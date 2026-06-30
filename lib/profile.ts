// lib/profile.ts
import { headers, cookies } from 'next/headers'

// Pour les Server Components : lit le header injecté par le middleware
export async function getActiveProfileId(): Promise<string | null> {
  const h = await headers()
  return h.get('x-profile-id')
}

// Pour les Server Actions : lit le cookie directement
export async function getActiveProfileIdFromCookie(): Promise<string | null> {
  const c = await cookies()
  return c.get('zelian_profile_id')?.value ?? null
}

export const PROFILE_COOKIE = 'zelian_profile_id'
export const MAX_PROFILES = 5
