# Spec Technique — Profil Utilisateur

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | profil-utilisateur  |
| Version       | 0.1.0               |
| Date          | 2026-06-24          |
| Source        | Rétro-ingénierie    |

## Architecture du module

Le module profil-utilisateur est structuré selon le pattern Next.js App Router : un Server Component (`app/profil/page.tsx`) gère l'auth check, le chargement des données et l'enrichissement TMDB, puis délègue l'intégralité du rendu interactif à un Client Component (`app/profil/ProfileClient.tsx`).

```
app/profil/page.tsx          (Server Component)
  ├── createClient()            Vérification d'identité (client anon SSR)
  ├── supabase.from('user_media_lists').select('*')   Chargement listes
  ├── supabase.from('user_preferences').select('*')   Chargement préférences
  ├── getMediaDetail() [TMDB]   Enrichissement lazy des items sans poster/titre
  ├── getRecommendations()      Algorithme de recommandation (lib/recommendations.ts)
  └── <ProfileClient />         Délégation du rendu interactif

app/profil/ProfileClient.tsx (Client Component)
  ├── Sidebar : avatar, pseudo, email, stats, boutons d'action
  ├── Modal d'édition (pseudo / email / password)
  ├── Listes : Section + MediaMiniGrid (mode consultation et mode édition)
  └── Recommandations : grille de posters linkés

app/actions/profile.ts       (Server Action)
  └── changeEmailAction()       Modification email via admin client

app/actions/watchlist.ts     (Server Actions)
  ├── removeFromList()          Suppression d'un item par UUID
  └── deleteList()              Suppression de tous les items d'une liste

app/actions/avatar.ts        (Server Action)
  └── uploadAvatarAction()      Upload vers Supabase Storage + écriture avatar_url en user_metadata
```

Le flux de données est unidirectionnel au chargement (Server → Client). Les mutations partent du Client Component via des appels directs Supabase navigateur (pseudo, password) ou via des Server Actions (email, items, listes, avatar), suivis d'un `router.refresh()` qui déclenche un rechargement du Server Component.

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `app/profil/page.tsx` | Server Component : auth check, chargement données, enrichissement TMDB, appel recommandations | ~51 |
| `app/profil/ProfileClient.tsx` | Client Component : rendu complet du profil (sidebar, modal édition, listes, recommandations) | ~593 |
| `app/actions/profile.ts` | Server Action `changeEmailAction` (modification email via client admin) | ~25 |
| `app/actions/watchlist.ts` | Server Actions `removeFromList` et `deleteList` (utilisées ici, partagées avec feature listes-personnelles) | ~128 |
| `app/actions/avatar.ts` | Server Action `uploadAvatarAction` (partagée avec feature upload-avatar) | ~39 |
| `lib/recommendations.ts` | Algorithme de recommandation (partagé avec feature recommandations) | N/A |
| `lib/tmdb.ts` | Fonction `getMediaDetail` pour enrichissement lazy | N/A |
| `lib/supabase/client.ts` | Client navigateur (pseudo, password, signOut, enrichissement avatar) | N/A |
| `lib/supabase/server.ts` | Client SSR (auth check dans page.tsx et actions) | N/A |
| `lib/supabase/admin.ts` | Client service_role (changeEmailAction, watchlist mutations) | N/A |
| `components/auth/AuthTabs.tsx` | Affiché à la place du profil si l'utilisateur n'est pas connecté | N/A |

## Schéma BDD

### Table `user_media_lists`

Utilisée en lecture (chargement de toutes les listes de l'utilisateur) et en écriture (suppression d'items et de listes).

| Colonne | Type | Contrainte |
|---------|------|-----------|
| `id` | UUID | PK, `DEFAULT gen_random_uuid()` |
| `user_id` | UUID | FK `auth.users`, NOT NULL |
| `tmdb_id` | INTEGER | NOT NULL |
| `media_type` | TEXT | CHECK `IN ('movie', 'tv')` |
| `list_type` | TEXT | CHECK `IN ('watchlist', 'watched')` — **incohérent avec les listes custom** (voir dette technique) |
| `rating` | INTEGER | CHECK entre 1 et 10, nullable |
| `poster_path` | TEXT | Nullable — enrichissement TMDB si absent |
| `title` | TEXT | Nullable — enrichissement TMDB si absent |
| `created_at` | TIMESTAMPTZ | `DEFAULT NOW()` |

Contrainte unique : `(user_id, tmdb_id, media_type)` — voir RETRO-003.
RLS activée — voir RETRO-002.

### Table `user_preferences`

Chargée dans `page.tsx` mais non affichée dans le profil v1 (passée avec underscore préfixe `_preferredGenres`).

| Colonne | Type | Contrainte |
|---------|------|-----------|
| `user_id` | UUID | PK + FK `auth.users` |
| `preferred_genres` | INTEGER[] | `DEFAULT '{}'` |
| `updated_at` | TIMESTAMPTZ | `DEFAULT NOW()` |

### Données dans `auth.users` (Supabase Auth)

Les champs de profil suivants sont stockés en `user_metadata` (JSON) sur l'objet `User` de GoTrue (voir RETRO-005) :

| Clé | Type JS | Description |
|-----|---------|-------------|
| `display_name` | `string \| undefined` | Pseudo de l'utilisateur |
| `avatar_url` | `string \| undefined` | URL publique Supabase Storage avec cache-busting (`?t=<timestamp>`) |

## API / Endpoints

Pas d'endpoint REST public exposé par ce module. Toutes les mutations passent par des Server Actions Next.js.

| Server Action | Signature | Auth | Description |
|---------------|-----------|------|-------------|
| `changeEmailAction` | `(newEmail: string) => Promise<{} \| { error: string }>` | `getUser()` obligatoire | Modifie l'email via admin client, `email_confirm: true` |
| `removeFromList` | `(id: string) => Promise<{} \| { error: string }>` | `getUser()` obligatoire | Supprime une ligne de `user_media_lists` par UUID |
| `deleteList` | `(listType: string) => Promise<{} \| { error: string }>` | `getUser()` obligatoire | Supprime toutes les lignes d'un `list_type` pour l'utilisateur |
| `uploadAvatarAction` | `(formData: FormData) => Promise<{ url: string } \| { error: string }>` | `getUser()` obligatoire | Upload avatar compressé vers Supabase Storage, met à jour `user_metadata.avatar_url` |

Appels directs au client Supabase navigateur (dans `ProfileClient.tsx`, sans Server Action) :

| Appel | Quand |
|-------|-------|
| `supabase.auth.updateUser({ data: { display_name } })` | Modification du pseudo |
| `supabase.auth.updateUser({ password })` | Changement du mot de passe |
| `supabase.auth.signOut()` | Déconnexion |

## Patterns identifiés

- **Server Component hydratant un Client Component** : `page.tsx` effectue toutes les opérations asynchrones (BDD + TMDB) et passe les résultats hydratés comme props à `ProfileClient`. Le Client Component ne fait aucun fetch au montage.
- **`router.refresh()` comme mécanisme de revalidation** : après chaque mutation (suppression item, modification profil, upload avatar), le composant client appelle `router.refresh()` pour déclencher un rechargement du Server Component et mettre à jour les données affichées. Pas de state management local des listes.
- **Pattern `getAuthUser()` + `createAdminClient()`** dans toutes les Server Actions (voir RETRO-002) : vérification d'identité via client anon, puis mutation via client service_role.
- **`revalidatePath('/profil')`** appelé dans chaque Server Action après mutation pour invalider le cache de la page côté Next.js.
- **Enrichissement lazy** : items sans `poster_path` ou `title` sont enrichis au rendu serveur via `getMediaDetail` TMDB individuel, en parallèle via `Promise.all`. Pas d'optimisation batch.
- **Compression Canvas côté client** : dans `ProfileClient.tsx`, la fonction `compressImage()` redimensionne l'image à max 400px (côté le plus long) et l'encode en JPEG qualité 0.85 via Canvas API avant l'envoi à la Server Action `uploadAvatarAction`. La compression est entièrement côté navigateur.
- **Composants locaux non exportés** : `Section` et `MediaMiniGrid` sont déclarés dans `ProfileClient.tsx` et non exportés — ils sont internes à ce fichier.
- **Gestion d'état de modal par `editMode`** : un seul état `editMode: 'pseudo' | 'email' | 'password' | null` contrôle quelle modale est affichée. Les trois modes partagent le même formulaire et la même logique de submit (`handleSubmit`).

## Configuration notable

- Le fichier `lib/supabase/admin.ts` contient un `console.log` en production qui décode et affiche partiellement le rôle du JWT de la service_role key (lignes 7-10). Violation de la règle Zelian #4. Déjà signalé dans RETRO-002 et RETRO-004.
- La contrainte `CHECK (list_type IN ('watchlist', 'watched'))` dans la migration `001_init.sql` est incompatible avec les listes custom du code applicatif (noms libres). Les upserts sur des listes custom avec le client admin bypasse la RLS mais pas les contraintes `CHECK` PostgreSQL — dette technique critique identifiée dans `discovery.md`.

## Décisions techniques documentées en spec-technique.md (non promues en ADR)

- **Modification d'email via admin avec `email_confirm: true`** : l'utilisation de `admin.auth.admin.updateUserById(..., { email_confirm: true })` contourne la vérification de l'email actuel et valide la nouvelle adresse sans confirmation par email. Confiné à `changeEmailAction` (1 fichier), le coût de revert est inférieur à 1 journée — ne passe pas Q1 ADR.
- **Stats calculées à la volée** : `watchedCount` et `watchlistCount` sont calculés par `grouped['watched'].length` et `grouped['watchlist'].length` côté client depuis les données hydratées. Pas de compteur dénormalisé. Pattern limité à `ProfileClient.tsx` — ne passe pas Q3 ADR.
- **Suppression de liste avec cascade applicative** : `deleteList` supprime toutes les lignes par `list_type` et `user_id` via une requête DELETE. Il n'y a pas de CASCADE ON DELETE au niveau BDD (la contrainte de liste custom n'existe pas en BDD — voir dette CHECK). Confiné à une seule Server Action — ne passe pas Q1 ADR.
- **Guard auth par rendu conditionnel** : `if (!user) return <AuthTabs />` dans `page.tsx` sans redirection HTTP. Décision déjà documentée dans RETRO-004, section "Guard d'authentification".

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `__tests__/actions/watchlist.test.ts` | `toggleWatchlist`, `removeFromList`, `deleteList` (mocks Supabase) | Existant |
| `__tests__/lib/recommendations.test.ts` | `aggregateTopGenres`, `filterOutWatched`, `getRecommendations` | Existant |
| `__tests__/lib/tmdb.test.ts` | `getMediaDetail` et autres fonctions TMDB | Existant |

**Couverture absente pour ce module :**
- Aucun test pour `app/actions/profile.ts` (`changeEmailAction`)
- Aucun test pour `app/actions/avatar.ts` (`uploadAvatarAction`)
- Aucun test pour `app/profil/page.tsx` (Server Component — enrichissement lazy, logique de chargement)
- Aucun test pour `app/profil/ProfileClient.tsx` (rendu, modal édition, interactions)
