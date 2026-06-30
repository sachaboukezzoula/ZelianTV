# Spec Technique — listes-personnelles

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | listes-personnelles |
| Version       | 0.1.0               |
| Date          | 2026-06-24          |
| Source        | Rétro-ingénierie    |

## Architecture du module

Le module repose sur trois couches coopérantes :

1. **Couche UI** : `WatchlistButton` (Client Component) gère l'état local (liste active, dropdown, création inline) et déclenche les Server Actions via `useTransition`.
2. **Couche contexte** : `ListsProvider` (Context React) partage la liste des noms de listes custom entre tous les `WatchlistButton` d'une même page, évitant les appels répétés à `getUserLists()`.
3. **Couche serveur** : les Server Actions (`app/actions/watchlist.ts`) gèrent l'auth, le bypass RLS, et la persistance dans Supabase.

Le rendu côté page profil est assuré par le Server Component `app/profil/page.tsx` qui charge toutes les données, et le Client Component `ProfileClient.tsx` qui gère l'affichage groupé et les interactions de gestion.

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `components/WatchlistButton.tsx` | Bouton principal avec dropdown, optimistic update, création inline | ~241 |
| `components/ListsProvider.tsx` | Context React pour les noms de listes, chargement initial via `getUserLists` | ~36 |
| `app/actions/watchlist.ts` | Server Actions : `getWatchlistData`, `toggleWatchlist`, `getUserLists`, `removeFromList`, `deleteList` | ~128 |
| `app/profil/ProfileClient.tsx` | Affichage groupé des listes, mode édition, suppression d'items et de listes | ~592 |
| `supabase/migrations/001_init.sql` | Table `user_media_lists`, contrainte UNIQUE, RLS | ~31 |
| `__tests__/actions/watchlist.test.ts` | Tests unitaires de `removeFromList` et `deleteList` | ~59 |

## Schéma BDD

### Table `user_media_lists`

| Colonne | Type | Contraintes |
|---------|------|-------------|
| `id` | UUID | PK, default `gen_random_uuid()` |
| `user_id` | UUID | FK `auth.users`, NOT NULL |
| `tmdb_id` | INTEGER | NOT NULL |
| `media_type` | TEXT | NOT NULL, CHECK IN ('movie', 'tv') |
| `list_type` | TEXT | NOT NULL, CHECK IN ('watchlist', 'watched') ⚠️ voir dette |
| `rating` | INTEGER | CHECK 1-10, nullable, non utilisé côté code |
| `created_at` | TIMESTAMPTZ | default NOW() |
| — | — | UNIQUE (user_id, tmdb_id, media_type) |

**RLS activée** : politique "Users manage their own lists" — `auth.uid() = user_id` sur toutes les opérations.

### Dette technique : contrainte `CHECK (list_type IN ('watchlist', 'watched'))` incompatible avec les listes custom

La migration `001_init.sql` restreint `list_type` à deux valeurs fixes. Le code applicatif permet la création de listes custom avec n'importe quel nom et effectue des `upsert` avec ces noms. En production, ces upserts retourneraient une erreur de contrainte CHECK de PostgreSQL. Deux options de résolution :
- Supprimer le CHECK et ne garder que la contrainte UNIQUE
- Remplacer le CHECK par une validation applicative dans la Server Action `toggleWatchlist`

### Champ `rating` (non utilisé)

Le champ `rating` (INTEGER 1-10 nullable) existe dans le schéma mais n'est lu ni écrit par aucun fichier du projet. Fonctionnalité prévue non implémentée.

## API / Endpoints (Server Actions)

Pas d'endpoint REST exposé. Toutes les mutations passent par les Server Actions Next.js (`'use server'`).

| Server Action | Signature | Description | Auth |
|---------------|-----------|-------------|------|
| `getWatchlistData` | `(tmdbId, mediaType)` | Renvoie l'utilisateur, la liste active pour ce média, et tous les noms de listes | Requiert user (renvoie nulls sinon) |
| `toggleWatchlist` | `(tmdbId, mediaType, target, currentListType, posterPath?, title?)` | Upsert ou delete selon si `target === currentListType` | Requiert user |
| `getUserLists` | `()` | Renvoie tous les `list_type` distincts de l'utilisateur | Requiert user (renvoie `[]` sinon) |
| `getWatchlistStatus` | `(tmdbId, mediaType)` | Alias de `getWatchlistData` sans `allLists` | Requiert user |
| `removeFromList` | `(id: string)` | Supprime un item par son UUID (vérifie `user_id`) | Requiert user |
| `deleteList` | `(listType: string)` | Supprime toutes les entrées d'une liste par son nom | Requiert user |

**Toutes les actions** appellent d'abord `getAuthUser()` (client anon, vérifie le JWT cookie), puis `createAdminClient()` (service_role, bypass RLS) pour la mutation. Ce pattern est décrit dans la politique de sécurité du projet (voir RETRO-002).

## Patterns identifiés

- **Optimistic update sans rollback** : dans `WatchlistButton.selectList()`, l'état local (`listType`) est mis à jour immédiatement avant l'appel à `toggleWatchlist`. En cas d'échec serveur, l'état local reste incorrect jusqu'au prochain rechargement de la page. C'est un choix UX documenté (fluidité > cohérence stricte).
- **Upsert avec `onConflict`** : `toggleWatchlist` utilise `upsert(..., { onConflict: 'user_id,tmdb_id,media_type' })` qui repose directement sur la contrainte UNIQUE en base. Le changement de liste (de "watchlist" vers "watched" par exemple) s'effectue par mise à jour de la colonne `list_type` via upsert, pas par delete + insert.
- **Context local optimiste** : `ListsProvider.addList()` ajoute le nom d'une nouvelle liste custom dans l'état React local sans attendre une confirmation serveur. La liste réelle en BDD est mise à jour par le `toggleWatchlist` de la même action.
- **Groupement côté client dans `ProfileClient`** : les items de `user_media_lists` sont chargés à plat depuis le Server Component et groupés par `list_type` dans le Client Component via `Array.reduce()`.
- **Fermeture du dropdown par overlay transparent** : un `div` fixe `z-10` couvre toute la page quand le dropdown est ouvert. Un clic dessus ferme le dropdown via `onClick={closeDropdown}`.

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `__tests__/actions/watchlist.test.ts` | `removeFromList` (auth check + appel delete) et `deleteList` (auth check + filtrage par user_id et list_type) | Existant, 4 tests |
| — | `getWatchlistData`, `toggleWatchlist`, `getUserLists` | Absent |
| — | `WatchlistButton` (optimistic update, dropdown, création inline) | Absent |
| — | `ListsProvider` (chargement initial, addList) | Absent |

Couverture partielle : seules les deux actions de suppression sont testées. L'action centrale `toggleWatchlist` (upsert + delete selon contexte) n'a pas de tests.
