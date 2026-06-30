# Spec Technique — recommandations

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | recommandations     |
| Version       | 0.1.0               |
| Date          | 2026-06-24          |
| Source        | Rétro-ingénierie    |

## Architecture du module

Le module de recommandations est entièrement côté serveur (Next.js Server Component + lib pure). Il ne dispose ni de Route Handler dédié, ni de Server Action, ni de state client. Son cycle de vie est lié au rendu de `app/profil/page.tsx`.

**Flux de données :**

```
app/profil/page.tsx (Server Component)
  └── getRecommendations(watched[]) — lib/recommendations.ts
        ├── getMediaDetail(tmdb_id, type) x N  ← lib/tmdb.ts  (genres)
        ├── aggregateTopGenres(genreSources, topN=3)
        ├── discoverByGenre(genres.join(','), 'movie')  ← lib/tmdb.ts
        ├── discoverByGenre(genres.join(','), 'tv')     ← lib/tmdb.ts
        └── filterOutWatched(merged, watchedSet)
              └── résultat.slice(0, 12)
```

**Composant d'affichage :**

```
app/profil/ProfileClient.tsx (Client Component)
  └── props.recommendations: Media[]
        └── section "Recommandations" — grille de posters <Link> + <Image>
```

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `lib/recommendations.ts` | Logique complète : agrégation genres, appels discover, exclusion vus | ~57 |
| `app/profil/page.tsx` | Orchestration serveur : charge `watched`, appelle `getRecommendations` | ~51 |
| `app/profil/ProfileClient.tsx` | Rendu de la section Recommandations (lignes 423-455) | ~593 |
| `lib/tmdb.ts` | Fonctions `getMediaDetail` et `discoverByGenre` utilisées par le module | ~167 |
| `__tests__/lib/recommendations.test.ts` | Tests unitaires pour `aggregateTopGenres` et `filterOutWatched` | ~26 |

## Schéma BDD (applicable)

Le module lit depuis la table `user_media_lists` via le Server Component parent. Il n'écrit pas en base.

| Table | Colonnes lues | Filtre |
|-------|---------------|--------|
| `user_media_lists` | `tmdb_id`, `media_type`, `list_type`, `poster_path`, `title` | `user_id = auth.uid()` et `list_type = 'watched'` |

Les genres ne sont **pas stockés en base** — ils sont récupérés en temps réel via TMDB (voir ADR RETRO-007).

## API TMDB consommée

| Endpoint TMDB | Rôle dans le module | Pagination |
|---------------|---------------------|------------|
| `GET /movie/{id}` | Récupérer les genres d'un film vu | Non |
| `GET /tv/{id}` | Récupérer les genres d'une série vue | Non |
| `GET /discover/movie?with_genres=&sort_by=popularity.desc&page=N` | Suggestions films par genre | 4 pages (1-4) |
| `GET /discover/tv?with_genres=&sort_by=popularity.desc&page=N` | Suggestions séries par genre | 4 pages (1-4) |

Les appels `getMediaDetail` utilisent le cache Next.js (`revalidate: 3600`). Les appels `discoverByGenre` également.

## Algorithmes

### aggregateTopGenres

Entrée : tableau d'objets `{ genres: number[] }`, paramètre `topN` (défaut : 3).

1. Construit une `Map<genreId, fréquence>` en itérant sur tous les genres de tous les items.
2. Trie les entrées par fréquence décroissante.
3. Retourne les `topN` premiers IDs de genre.

En cas d'égalité de fréquence, l'ordre est déterminé par l'ordre d'insertion dans la Map (premier genre rencontré). Ce comportement est implicite — non documenté dans le code.

### filterOutWatched

Entrée : tableau de medias `T extends { id: number }`, Set des IDs déjà vus.

Filtre simple : `items.filter(item => !watchedIds.has(item.id))`.

### discoverByGenre (dans lib/tmdb.ts)

Exécute 4 requêtes TMDB `/discover/{type}` en parallèle (pages 1 à 4) avec les genres passés en `with_genres` (IDs séparés par virgule). Appelle la fonction interne `dedup` sur le résultat fusionné pour éliminer les doublons sur `id`. Retourne jusqu'à ~80 médias dédupliqués par type.

## Patterns identifiés

- **Compute-on-read** : les genres ne sont pas matérialisés en base. Ils sont recalculés à chaque rendu depuis l'API TMDB (voir ADR RETRO-007 pour les implications).
- **Promise.allSettled pour résilience partielle** : lors de la récupération des genres, les échecs individuels n'interrompent pas le calcul — seuls les items réussis contribuent à l'agrégation.
- **Promise.all pour parallélisme** : les appels `discoverByGenre` films et séries, et les 4 pages de chaque discover, sont exécutés en parallèle.
- **Early return sur liste vide** : `if (watched.length === 0) return []` évite tout appel réseau inutile.
- **Fusion ordonnée** : le résultat final fusionne `[...movies, ...series]` — les films apparaissent en premier dans les 12 suggestions.

## Configuration

- Limite de recommandations retournées : `limit = 12` (paramètre par défaut de `getRecommendations`).
- Nombre de genres retenus : `topN = 3` (paramètre par défaut de `aggregateTopGenres`).
- Pages TMDB discover : 4 (hardcodé dans `discoverByGenre`).
- Cache TMDB : `revalidate: 3600` (1h, via `fetchTMDB` dans `lib/tmdb.ts`).

## Décisions d'implémentation (non-architecturales)

Les décisions suivantes ont été examinées comme candidats ADR et rejetées car elles n'atteignent pas le seuil architectural.

**"Algorithme top-N genres par fréquence"** (rejeté : AP-3 — heuristique d'implémentation interne à un seul module, remplaçable dans `lib/recommendations.ts` sans impact transverse).

**"Appel discoverByGenre sur 4 pages parallèles"** (rejeté : AP-3 — optimisation de volume locale, confinée à `lib/tmdb.ts`).

**"Exclusion des vus via Set en mémoire"** (rejeté : Q3=NON — impact mono-module, décision confinée à `filterOutWatched` dans `recommendations.ts`).

**"Fusion films+séries avec films en premier"** (rejeté : AP-6 — convention d'ordre dans une liste, pas d'invariant métier).

## Dette technique identifiée

- **N+1 TMDB sur l'agrégation des genres** : pour chaque média `watched`, un appel `getMediaDetail` est effectué pour récupérer ses genres. Si l'utilisateur a 50 médias vus, cela génère 50 appels TMDB au rendu de la page profil (atténué par le cache `revalidate: 3600`, mais non nul en premier chargement ou après expiration du cache).
- **Genres non stockés en base** : une colonne `genres` sur `user_media_lists` permettrait d'éviter ces N appels TMDB lors de l'agrégation. Ce refactoring implique une migration de schéma et une modification de la Server Action `toggleWatchlist` pour stocker les genres à l'ajout.
- **Absence de test pour `getRecommendations`** : seules `aggregateTopGenres` et `filterOutWatched` sont couvertes par les tests unitaires. La fonction orchestratrice `getRecommendations` n'est pas testée (elle nécessiterait un mock de `getMediaDetail` et `discoverByGenre`).

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `__tests__/lib/recommendations.test.ts` | `aggregateTopGenres` (top 3, entrée vide) et `filterOutWatched` (exclusion par ID) | Existant |
| `getRecommendations` | Non testée | Absent |
