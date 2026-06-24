// app/profils/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfiles } from '@/app/actions/profiles'
import { ProfilesClient } from './ProfilesClient'

export default async function ProfilsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/connexion')

  const profiles = await getProfiles()

  // Nouveau user sans profil → forcer la création
  if (profiles.length === 0) redirect('/profils/nouveau')

  return <ProfilesClient profiles={profiles} />
}
