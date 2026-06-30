// app/profils/nouveau/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ProfileCreateClient } from './ProfileCreateClient'

export default async function NouveauProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/connexion')

  return <ProfileCreateClient />
}
