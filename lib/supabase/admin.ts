import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString())
    console.log('[admin] key role:', payload.role)
  } catch {
    console.log('[admin] key decode failed')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key
  )
}
