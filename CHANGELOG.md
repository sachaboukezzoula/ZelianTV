# CHANGELOG — Mini Netflix

## [0.1.0] — 2026-06-22

### Ajouté
- Scaffold Next.js 16 + TypeScript + Tailwind CSS v4 + Supabase + Jest
- `lib/tmdb.ts` — client TMDB complet (trending, popular, search, detail, videos, credits)
- `lib/supabase/client.ts` + `lib/supabase/server.ts` — clients Supabase SSR
- `lib/recommendations.ts` — algorithme de recommandations par genres
- `proxy.ts` — rafraîchissement session Supabase (Next.js 16 proxy)
- `supabase/migrations/001_init.sql` — tables `user_media_lists` + `user_preferences` avec RLS
- `components/Navbar.tsx` — navbar sticky, logo orange, search pill, hamburger mobile
- `components/HeroBanner.tsx` — backdrop pleine largeur, badge TENDANCES #1, CTAs orange
- `components/MediaCard.tsx` — poster TMDB, titre, note orange, hover scale
- `components/MediaRow.tsx` — rangée horizontale scrollable
- `components/FilterBar.tsx` — toggle Film/Série + pills genres (Client Component)
- `components/SearchBar.tsx` — recherche TMDB live, debounce 300ms, dropdown
- `components/Loader.tsx` — squelettes MediaCard/MediaRow
- `components/YoutubePlayer.tsx` — iframe YouTube lazy-load, bouton play orange
- `components/WatchlistButton.tsx` — À voir / Déjà vu, sync Supabase
- `components/auth/LoginForm.tsx` + `SignupForm.tsx` — formulaires email, thème dark
- `app/page.tsx` — catalogue : HeroBanner + FilterBar + MediaRows (Server Component)
- `app/media/[id]/page.tsx` — fiche détail avec backdrop, genres, trailer, distribution
- `app/profil/page.tsx` + `ProfileClient.tsx` — auth + listes + recommandations
- `app/api/search/route.ts` — GET /api/search?q= handler
- 14 tests Jest passants (tmdb: 9, recommendations: 3, WatchlistButton: 2)

### Stack
- Next.js 16.2.9, React 19, TypeScript 5, Tailwind CSS v4
- Supabase @supabase/ssr v0.12, @supabase/supabase-js v2
- Jest 30, @testing-library/react 16
