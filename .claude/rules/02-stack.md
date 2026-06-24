# Stack technique du projet

> Fichier généré automatiquement par le subagent `stack-detector` lors de l'initialisation.
> Dernière détection : 2026-06-24

## Frontend

- **Framework :** Next.js 16.2.9 (App Router)
- **Langage :** TypeScript 5 (strict mode activé)
- **UI :** Tailwind CSS v4 (via `@tailwindcss/postcss`) — design system custom dark, token CSS via `@theme inline`
- **Police :** Geist Sans (via `next/font/google`)
- **State management :** Pas de librairie dédiée — état local React (`useState`), Context API (`ListsProvider`) et Server Actions Next.js
- **Structure :** App Router (`app/`) sans dossier `src/`, alias `@/` mappé à la racine

### Conventions frontend

- Composants en PascalCase dans `components/` à la racine
- Sous-dossier `components/auth/` pour les composants d'authentification (LoginForm, SignupForm, AuthTabs)
- Pages en `app/<route>/page.tsx`, layouts en `app/<route>/layout.tsx`
- Server Actions dans `app/actions/<domaine>.ts` avec la directive `'use server'`
- Route Handlers dans `app/api/<ressource>/route.ts`
- Librairies métier dans `lib/` : `tmdb.ts` (client API TMDB), `recommendations.ts` (algo de recommandation), `utils.ts` (utilitaires)
- Client Supabase séparé selon contexte : `lib/supabase/client.ts` (navigateur), `lib/supabase/server.ts` (Server Components), `lib/supabase/admin.ts` (service role)
- Alias d'import : `@/` → racine du projet (configuré dans `tsconfig.json` paths)
- Thème dark hardcodé : `bg-[#141414]` / CSS variables dans `globals.css`
- Revalidation Next.js sur les fetches TMDB : `{ next: { revalidate: 3600 } }` (cache 1h)

### Commandes frontend

```bash
npm run dev      # Démarre le serveur de développement Next.js (port 3000)
npm run build    # Build de production Next.js
npm run start    # Démarre le serveur de production
npm run lint     # ESLint (flat config, règles next/core-web-vitals + typescript)
npm test         # Lance Jest (jest-environment-jsdom, ts-jest)
```

## Backend

> Le backend est **intégré dans ce repo via Next.js** (App Router + Server Actions + Route Handlers). Pas de serveur backend séparé.

- **Framework :** Next.js 16.2.9 — Route Handlers (`app/api/`) + Server Actions (`app/actions/`)
- **Langage :** TypeScript 5
- **BDD :** Supabase (PostgreSQL managé)
- **ORM / Accès BDD :** Supabase JS SDK (`@supabase/supabase-js` v2, `@supabase/ssr` v0.12) — pas d'ORM classique
- **Auth :** Supabase Auth (GoTrue) — cookies gérés via `@supabase/ssr`, middleware de session dans `proxy.ts`
- **API externe consommée :** TMDB API v3 (`https://api.themoviedb.org/3`) — clé `TMDB_API_KEY` côté serveur uniquement
- **Middleware :** `proxy.ts` — rafraîchit la session Supabase sur chaque requête via `matcher` universel

### Architecture backend

```
app/
  actions/
    watchlist.ts   — Server Actions CRUD watchlist/listes (Supabase admin client)
    profile.ts     — Server Actions profil utilisateur
    avatar.ts      — Server Actions gestion avatar
  api/
    search/
      route.ts     — Route Handler GET /api/search?q= (proxy vers TMDB searchMulti)
  profil/
    page.tsx       — Page profil (Server Component)
    ProfileClient.tsx — Partie cliente du profil

lib/
  tmdb.ts          — Client TMDB (fetch natif, revalidate 1h)
  recommendations.ts — Algorithme de recommandation par genre
  supabase/
    client.ts      — Client navigateur (NEXT_PUBLIC_SUPABASE_ANON_KEY)
    server.ts      — Client Server Component (cookies Next.js)
    admin.ts       — Client service role (SUPABASE_SERVICE_ROLE_KEY, bypass RLS)
```

### Schéma BDD (Supabase / PostgreSQL)

Migrations dans `supabase/migrations/`, appliquées via Supabase CLI ou dashboard.

- `user_media_lists` — watchlist et listes de visionnage par utilisateur (FK `auth.users`, RLS activée)
- `user_preferences` — genres préférés de l'utilisateur (FK `auth.users`, RLS activée)
- RLS (Row Level Security) activée sur toutes les tables — politique `auth.uid() = user_id`

### Conventions backend

- Les Server Actions utilisent toujours le **client admin** (`createAdminClient`) pour contourner le RLS au niveau service, après avoir vérifié l'utilisateur via `getAuthUser()` (qui utilise le client serveur normal)
- Revalidation de cache après mutation : `revalidatePath('/profil')`
- Pas d'endpoint REST classique pour les mutations — tout passe par les Server Actions
- Variables d'environnement sensibles (`SUPABASE_SERVICE_ROLE_KEY`, `TMDB_API_KEY`) : jamais exposées côté client

### Commandes backend (migrations Supabase)

```bash
# Requiert Supabase CLI installé
supabase migration new <nom>   # Crée une nouvelle migration
supabase db push               # Applique les migrations
supabase db reset              # Réinitialise la BDD de dev
```

## Outils transverses

- **Gestionnaire de paquets :** npm (package-lock.json présent)
- **Tests :** Jest 30 + jest-environment-jsdom + ts-jest + @testing-library/react 16 + @testing-library/user-event
  - Config : `jest.config.js` + `jest.setup.ts`
  - Tests dans `__tests__/` avec sous-dossiers miroirs : `__tests__/lib/`, `__tests__/actions/`, `__tests__/components/`
  - Fichiers de test : `*.test.ts`
- **Linter :** ESLint v9 (flat config `eslint.config.mjs`) — règles `next/core-web-vitals` + `next/typescript`
- **CSS :** PostCSS via `postcss.config.mjs` avec `@tailwindcss/postcss` (Tailwind v4)
- **TypeScript :** `strict: true`, `noEmit: true`, `moduleResolution: bundler`
- **CI/CD :** Non identifié (pas de `.github/workflows/` ou équivalent détecté)
- **Docker :** Non identifié (pas de `Dockerfile` ni `docker-compose.yml`)
- **Monorepo :** Non — projet single-app

## Variables d'environnement requises

| Variable | Côté | Description |
|---|---|---|
| `TMDB_API_KEY` | Serveur uniquement | Clé API The Movie Database v3 |
| `NEXT_PUBLIC_SUPABASE_URL` | Public (client + serveur) | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (client + serveur) | Clé anonyme Supabase (RLS activée) |
| `SUPABASE_SERVICE_ROLE_KEY` | Serveur uniquement | Clé service role Supabase (bypass RLS) |

Voir `.env.example` à la racine pour le template.
