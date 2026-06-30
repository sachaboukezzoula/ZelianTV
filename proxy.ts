// proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const PROFILE_COOKIE = 'zelian_profile_id'

// Routes qui ne nécessitent pas de profil actif
const PUBLIC_PATHS = ['/profils', '/connexion', '/api/', '/_next', '/favicon']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Utilisateur non connecté : laisser passer (auth gérée par les pages)
  if (!user) return supabaseResponse

  // Routes publiques (profils, auth, api) : pas de vérification profil
  if (isPublicPath(request.nextUrl.pathname)) return supabaseResponse

  const profileId = request.cookies.get(PROFILE_COOKIE)?.value

  // Pas de cookie profil → rediriger vers l'écran de sélection
  if (!profileId) {
    return NextResponse.redirect(new URL('/profils', request.url))
  }

  // Valider que le profil appartient à l'utilisateur
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('id', profileId)
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    // Cookie invalide → supprimer et rediriger
    const response = NextResponse.redirect(new URL('/profils', request.url))
    response.cookies.delete(PROFILE_COOKIE)
    return response
  }

  // Injecter le profile_id en header pour les Server Components
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-profile-id', profileId)

  supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Re-propager les cookies Supabase sur la nouvelle response
  request.cookies.getAll().forEach(({ name, value }) => {
    supabaseResponse.cookies.set(name, value)
  })

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
