// app/profils/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfiles } from '@/app/actions/profiles'
import { getProfileStats } from '@/app/actions/watchlist'
import { ProfilesClient } from './ProfilesClient'

export default async function ProfilsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const profiles = await getProfiles()

  if (profiles.length === 0) redirect('/profils/nouveau')

  const profilesWithStats = await Promise.all(
    profiles.map(async (p) => {
      const stats = await getProfileStats(p.id)
      return { ...p, ...stats }
    })
  )

  return <ProfilesClient profiles={profilesWithStats} />
}
