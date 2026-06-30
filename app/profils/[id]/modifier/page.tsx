// app/profils/[id]/modifier/page.tsx
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getProfiles } from '@/app/actions/profiles'
import { ProfileEditClient } from './ProfileEditClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ModifierProfilPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  const profiles = await getProfiles()
  const profile = profiles.find(p => p.id === id)
  if (!profile) notFound()

  const canDelete = profiles.length > 1

  return <ProfileEditClient profile={profile} canDelete={canDelete} />
}
