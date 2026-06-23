import { createClient } from '@/lib/supabase/server'
import { ProfileClient } from '@/app/profil/ProfileClient'
import { AuthTabs } from '@/components/auth/AuthTabs'
import { getRecommendations } from '@/lib/recommendations'

export default async function ProfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <AuthTabs />
  }

  const [{ data: lists }, { data: prefs }] = await Promise.all([
    supabase.from('user_media_lists').select('*').eq('user_id', user.id),
    supabase.from('user_preferences').select('*').eq('user_id', user.id).single(),
  ])

  const watched = (lists ?? []).filter((l: { list_type: string }) => l.list_type === 'watched')
  const recommendations = await getRecommendations(watched).catch(() => [])

  return (
    <ProfileClient
      user={user}
      lists={lists ?? []}
      preferredGenres={prefs?.preferred_genres ?? []}
      recommendations={recommendations}
    />
  )
}

