'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function uploadAvatarAction(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Fichier manquant' }

  const admin = createAdminClient()

  // Crée le bucket s'il n'existe pas encore
  await admin.storage.createBucket('avatars', { public: true }).catch(() => {})

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const fileName = `${user.id}.jpg`

  const { error: uploadError } = await admin.storage
    .from('avatars')
    .upload(fileName, buffer, { upsert: true, contentType: 'image/jpeg' })

  if (uploadError) return { error: `Upload échoué : ${uploadError.message}` }

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(fileName)
  // Timestamp pour forcer le rechargement même si l'URL de base est identique
  const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`

  const { error: metaError } = await supabase.auth.updateUser({ data: { avatar_url: cacheBustedUrl } })
  if (metaError) return { error: metaError.message }

  revalidatePath('/profil')
  return { url: cacheBustedUrl }
}

export async function uploadProfileAvatarAction(formData: FormData, profileId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté' }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return { error: 'Fichier manquant' }

  // Vérifier que le profil appartient à l'utilisateur
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', user.id)
    .single()

  if (!profile) return { error: 'Profil introuvable.' }

  await admin.storage.createBucket('profile-avatars', { public: true }).catch(() => {})

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const fileName = `${profileId}.jpg`

  const { error: uploadError } = await admin.storage
    .from('profile-avatars')
    .upload(fileName, buffer, { upsert: true, contentType: 'image/jpeg' })

  if (uploadError) return { error: `Upload échoué : ${uploadError.message}` }

  const { data: { publicUrl } } = admin.storage.from('profile-avatars').getPublicUrl(fileName)
  const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`

  revalidatePath('/profils')
  return { url: cacheBustedUrl }
}
