'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function changeEmailAction(newEmail: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non connecté' }

  const trimmed = newEmail.trim().toLowerCase()
  if (!trimmed || !trimmed.includes('@')) return { error: 'Adresse email invalide.' }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email: trimmed,
    email_confirm: true,
  })

  if (error) return { error: error.message }

  revalidatePath('/profil')
  return {}
}
