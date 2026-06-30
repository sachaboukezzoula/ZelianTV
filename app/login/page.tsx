import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTrending, getMovieGenres, getTvGenres } from '@/lib/tmdb'
import { LoginSplitPage } from '@/components/auth/LoginSplitPage'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/profil')

  const [trending, movieGenres, tvGenres] = await Promise.all([
    getTrending(),
    getMovieGenres(),
    getTvGenres(),
  ])

  const items = trending.filter(item => item.backdrop_path).slice(0, 8)

  return <LoginSplitPage trending={items} movieGenres={movieGenres} tvGenres={tvGenres} />
}
