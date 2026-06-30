# Discovery — ZelianTV (mini-netflix)

> Fichier généré automatiquement par retro-scanner. Usage interne uniquement.
> Ce fichier sera supprimé à la fin de la Phase 1-bis.

## Stack identifiée

| Composant | Valeur |
|-----------|--------|
| Framework | Next.js 16.2.9 (App Router, sans dossier `src/`) |
| Langage | TypeScript 5 (strict mode) |
| SGBD | PostgreSQL via Supabase (managé) |
| ORM | Supabase JS SDK v2 (`@supabase/supabase-js` + `@supabase/ssr`) — pas d'ORM classique |
| Auth | Supabase Auth (GoTrue) — email/password, cookies gérés via `@supabase/ssr`, session rafraîchie par `proxy.ts` |
| UI | Tailwind CSS v4 (`@tailwindcss/postcss`), design system dark custom, police Geist Sans |
| API externe | TMDB API v3 (`api.themoviedb.org/3`) — clé serveur uniquement |
| State | React local (`useState`), Context API (`ListsProvider`), Server Actions Next.js |
| Tests | Jest 30 + jest-environment-jsdom + ts-jest + @testing-library/react 16 |
| Package manager | npm (package-lock.json) |
| Monorepo | Non — single-app |

## Features identifiées

### 1. Catalogue home (page d'accueil)
**Description :** Page principale Server Component qui affiche un HeroBanner avec le média tendance #1, une FilterBar Film/Série + genres, et plusieurs rangées de médias (tendances, populaires). Filtre par genre via `?genre=<id>` et par type via `?type=movie|tv` dans les searchParams.
**Fichiers principaux :**
- `app/page.tsx` — Server Component principal, fetch parallèle TMDB
- `components/HeroBanner.tsx` — backdrop pleine largeur, badge, CTAs
- `components/FilterBar.tsx` — toggle type + pills genres (Client Component, useTransition)
- `components/MediaRow.tsx` — rangée horizontale scrollable
- `lib/tmdb.ts` — fonctions `getTrendingMovies`, `getTrendingTv`, `getPopularMovies`, `getPopularTv`, `discoverByGenre`, `filterWithContent`

### 2. Recherche TMDB live
**Description :** Barre de recherche en Client Component avec debounce 300ms, appel vers le Route Handler `/api/search?q=`, dropdown de résultats avec poster, titre et note. Accessible depuis la Navbar (desktop centré, mobile dans le menu hamburger).
**Fichiers principaux :**
- `components/SearchBar.tsx` — debounce maison, fetch `/api/search`, dropdown
- `app/api/search/route.ts` — Route Handler GET, proxy vers `searchMulti` TMDB, retourne max 8 résultats
- `lib/tmdb.ts` — fonction `searchMulti`
- `components/Navbar.tsx` — intégration SearchBar, responsive hamburger

### 3. Fiche détail média
**Description :** Page dynamique `app/media/[id]/page.tsx` avec segment d'URL `movie-<tmdbId>` ou `tv-<tmdbId>`. Affiche backdrop, poster, titre, genres, notes, synopsis, distribution (max 10 acteurs), trailer YouTube. Layout responsive : mobile (colonne) vs desktop (grille 2 colonnes). Génère les métadonnées OpenGraph dynamiquement.
**Fichiers principaux :**
- `app/media/[id]/page.tsx` — parsing d'URL, fetch parallèle (détail + vidéos + crédits), layouts mobile/desktop
- `components/YoutubePlayer.tsx` — iframe YouTube lazy-load
- `components/PosterPlayer.tsx` — poster cliquable → player YouTube (desktop)
- `components/WatchlistButton.tsx` — bouton d'ajout aux listes (voir feature 4)
- `lib/tmdb.ts` — `getMediaDetail`, `getVideos`, `getCredits`

### 4. Listes personnelles (watchlist)
**Description :** Système de listes par utilisateur : deux listes fixes (`watchlist` = À voir, `watched` = Déjà vu) et des listes custom nommées librement. Le `WatchlistButton` permet l'ajout/retrait via un dropdown avec création de liste inline. Optimistic update côté client (pas d'attente du serveur). Persisté dans `user_media_lists` (Supabase, RLS). Le `ListsProvider` (Context) synchronise les noms de listes entre composants sans prop-drilling.
**Fichiers principaux :**
- `components/WatchlistButton.tsx` — dropdown, optimistic update, création liste inline, `useTransition`
- `components/ListsProvider.tsx` — Context React pour les noms de listes
- `app/actions/watchlist.ts` — Server Actions : `toggleWatchlist`, `getWatchlistData`, `getUserLists`, `removeFromList`, `deleteList`
- `supabase/migrations/001_init.sql` — table `user_media_lists`, contrainte unique `(user_id, tmdb_id, media_type)`, RLS

### 5. Authentification email/password
**Description :** Auth email/password via Supabase Auth (GoTrue). Deux formulaires (connexion + inscription) présentés en onglets sur `/profil` quand l'utilisateur n'est pas connecté. Inclut une fonction "mot de passe oublié" (resetPasswordForEmail). Gestion de session côté serveur via `@supabase/ssr` et rafraîchissement de session à chaque requête dans `proxy.ts`.
**Fichiers principaux :**
- `components/auth/AuthTabs.tsx` — onglets connexion/inscription
- `components/auth/LoginForm.tsx` — signInWithPassword + resetPasswordForEmail
- `components/auth/SignupForm.tsx` — signUp email/password
- `proxy.ts` — middleware de session Supabase (rafraîchit le cookie sur toute requête)
- `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts` — trois clients selon contexte

### 6. Profil utilisateur
**Description :** Page `/profil` (Server Component) qui charge les listes et préférences de l'utilisateur, enrichit les items sans poster_path via TMDB, puis délègue le rendu au `ProfileClient`. Permet la modification du pseudo (via `supabase.auth.updateUser`), de l'email (via Server Action + admin client), et du mot de passe (côté client). Affiche des stats (nb films vus, à voir, listes perso) dans une sidebar sticky.
**Fichiers principaux :**
- `app/profil/page.tsx` — Server Component, auth check, chargement données, enrichissement TMDB
- `app/profil/ProfileClient.tsx` — Client Component, édition profil (pseudo/email/password), gestion listes, modal édition
- `app/actions/profile.ts` — Server Action `changeEmailAction` (admin client, `email_confirm: true`)
- `lib/supabase/server.ts` — client Server Component pour l'auth check

### 7. Upload et gestion d'avatar
**Description :** Upload d'avatar via un input `<file>` caché déclenché au clic sur l'avatar. Compression côté client avec Canvas API (max 400px, JPEG 0.85 qualité) avant envoi. Upload vers le bucket Supabase Storage `avatars` (création automatique du bucket si absent), fichier nommé `<user_id>.jpg` (upsert). URL publique avec cache-busting (`?t=<timestamp>`) stockée dans `user.user_metadata.avatar_url`.
**Fichiers principaux :**
- `app/actions/avatar.ts` — Server Action `uploadAvatarAction`, compression déjà faite côté client
- `app/profil/ProfileClient.tsx` — logique de compression Canvas (`compressImage`), déclenchement upload, overlay hover

### 8. Recommandations personnalisées
**Description :** Algorithme côté serveur qui analyse les genres des médias marqués `watched` par l'utilisateur, agrège les top 3 genres par fréquence, et appelle TMDB `discover` (films + séries) filtrés par ces genres. Exclut les médias déjà vus. Retourne max 12 suggestions, affichées sur la page profil.
**Fichiers principaux :**
- `lib/recommendations.ts` — `aggregateTopGenres`, `filterOutWatched`, `getRecommendations`
- `app/profil/page.tsx` — appel `getRecommendations(watched)` côté serveur
- `app/profil/ProfileClient.tsx` — section Recommandations avec grille de posters

## Décisions techniques clés

1. **Middleware de session en `proxy.ts` au lieu de `middleware.ts`** — Next.js 16 a renommé la convention : le fichier `middleware.ts` exporte une fonction `proxy` et une config `matcher` universelle (toutes routes sauf assets statiques). Le rafraîchissement de session Supabase se fait sur chaque requête.

2. **Deux niveaux de client Supabase** — Client `anon` (RLS active, contexte navigateur et Server Components) pour les lectures et la vérification d'identité, client `service_role` (bypass RLS, jamais exposé côté client) pour toutes les mutations dans les Server Actions. Pattern `getAuthUser()` + `createAdminClient()` systématique dans `app/actions/`.

3. **Optimistic update dans WatchlistButton** — L'état local est mis à jour immédiatement, la Server Action est appelée en arrière-plan via `useTransition`. Pas de rollback en cas d'erreur (choix délibéré de l'état UX fluide sur la cohérence stricte).

4. **`list_type` libre en base mais contrainte en BDD v1** — La migration `001_init.sql` pose un `CHECK (list_type IN ('watchlist', 'watched'))`, mais le code applicatif permet la création de listes custom avec n'importe quel nom. La contrainte BDD est donc incompatible avec les listes custom — les upserts sur des noms personnalisés échoueraient en production. Dette technique identifiée.

5. **Cache TMDB via `fetch` natif Next.js** — Toutes les requêtes TMDB passent par `fetch` avec `{ next: { revalidate: 3600 } }` (cache 1h). Pas de librairie de cache dédiée. La fonction `filterWithContent` fait des appels TMDB pour chaque item de la liste (N+1 implicite) pour vérifier la présence d'un trailer.

6. **`console.log` de debug dans `admin.ts`** — Le client admin logue en production le rôle du JWT de la service role key (lignes 7-10 de `lib/supabase/admin.ts`). Violation de la règle absolue #4 des rules Zelian.

7. **Enrichissement lazy des items watchlist** — Sur la page profil, les items sans `poster_path` ou `title` font un `getMediaDetail` TMDB individuel au moment du rendu serveur. Potentiel de N appels TMDB parallèles selon la taille de la watchlist.

8. **Design system via CSS variables dans `globals.css`** — Le thème dark est défini via des variables CSS (`--accent: #f97316`, `--navbar`, `--border`, `--text`, `--text-muted`, `--surface`) utilisées dans les composants. Tailwind v4 avec `@theme inline` permet l'usage de ces variables directement dans les classes utilitaires.

## Évaluation qualité globale

| Critère | État |
|---------|------|
| Tests présents | Oui — 4 fichiers de test dans `__tests__/` (actions, components, lib x2), ~14 tests Jest. Couverture partielle : watchlist actions + recommendations algo + tmdb client. Pas de tests E2E ni de tests des Server Components. |
| Structure | Organisée — séparation claire App Router / components / lib / actions. Nommage cohérent PascalCase composants, camelCase fonctions. |
| Gestion d'erreurs | Dispersée — try/catch dans les formulaires client, `.catch(() => [])` sur les appels TMDB dans les pages, pas de boundary d'erreur React globale. Les Server Actions retournent `{ error: string }` sans typage discriminé systématique. |
| Documentation | Partielle — `CHANGELOG.md` à jour, `02-stack.md` complet, pas de README technique fonctionnel, pas de commentaires JSDoc dans le code. |
| Règles Zelian | 1 violation active : `console.log` dans `lib/supabase/admin.ts` (règle #4). |
| Dette technique identifiée | Contrainte `CHECK list_type IN ('watchlist', 'watched')` en BDD incompatible avec les listes custom du code applicatif. N+1 TMDB dans `filterWithContent` et l'enrichissement profil. |
