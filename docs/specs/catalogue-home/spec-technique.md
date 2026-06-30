# Spec Technique — catalogue-home

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | catalogue-home      |
| Version       | 0.1.0               |
| Date          | 2026-06-24          |
| Source        | Rétro-ingénierie    |

## Architecture du module

La feature repose sur un Server Component racine (`app/page.tsx`) qui orchestre l'ensemble des appels TMDB en deux vagues parallèles, puis délègue le rendu à des sous-composants spécialisés.

**Flux de données :**

```
app/page.tsx (Server Component, async)
  ├── Vague 1 — Promise.all (7 appels TMDB en parallèle)
  │     ├── getTrending()              → trendingAll (non utilisé dans le rendu)
  │     ├── getTrendingMovies()        → pages 1+2, dédup
  │     ├── getTrendingTv()            → pages 1+2, dédup
  │     ├── getPopularMovies() | discoverByGenre(genre, 'movie')
  │     ├── getPopularTv()    | discoverByGenre(genre, 'tv')
  │     ├── getMovieGenres()
  │     └── getTvGenres()
  │
  ├── Calcul du hero (trendingMovies[0] ou trendingTv[0] selon ?type=)
  │
  ├── Vague 2 — Promise.all (4 appels, dont N appels TMDB /videos chacun)
  │     ├── filterWithContent(rawTrending, mediaType)  → appelle getVideos() par item
  │     ├── filterWithContent(movies, 'movie')         → appelle getVideos() par item
  │     ├── filterWithContent(series, 'tv')            → appelle getVideos() par item
  │     └── getVideos(hero.id, heroType)               → trailer du hero
  │
  └── Rendu JSX
        ├── HeroBanner (Server Component)
        ├── FilterBar (Client Component, Suspense)
        └── MediaRow x1-3 (Client Component, avec scroll)
              └── MediaCard x N (Server Component rendu côté serveur)
```

**Frontière Server/Client :**
- `app/page.tsx` — Server Component (async, fetch TMDB côté serveur)
- `components/HeroBanner.tsx` — Server Component (pas de directive 'use client')
- `components/HeroTrailerButton.tsx` — Client Component ('use client', gère l'état `open` de la modale)
- `components/FilterBar.tsx` — Client Component ('use client', navigation via `useRouter` + `useSearchParams`)
- `components/MediaRow.tsx` — Client Component ('use client', scroll via `useRef` + `useCallback`)
- `components/MediaCard.tsx` — Server Component (rendu statique, lien vers la fiche détail)

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `app/page.tsx` | Server Component racine, orchestration des fetches TMDB, rendu conditionnel des rangées | ~75 |
| `components/HeroBanner.tsx` | Affichage du média hero : backdrop, titre, note, année, overview, boutons CTA | ~68 |
| `components/HeroTrailerButton.tsx` | Bouton trailer avec modale YouTube intégrée, gestion focus/scroll/Échap | ~81 |
| `components/FilterBar.tsx` | Toggle Film/Série + pills genres scrollables, navigation URL via `router.push` | ~109 |
| `components/MediaRow.tsx` | Rangée horizontale scrollable avec flèches hover, titre de section | ~60 |
| `components/MediaCard.tsx` | Carte poster cliquable (140-180px), lien vers `/media/<type>-<id>` | ~58 |
| `lib/tmdb.ts` | Client TMDB : types `Media`, `Genre`, `Video`, toutes les fonctions fetch, helpers URL/titre/année | ~166 |

## Schéma BDD

Cette feature ne lit ni n'écrit en base de données. Toutes les données proviennent exclusivement de l'API TMDB (lecture seule, pas de persistance locale).

## API / Endpoints TMDB consommés

| Méthode | Endpoint TMDB | Fonction dans `lib/tmdb.ts` | Description |
|---------|---------------|-----------------------------|-------------|
| GET | `/trending/all/week` | `getTrending()` | Tendances toutes catégories (résultat non utilisé dans le rendu actuel) |
| GET | `/trending/movie/week?page=1` | `getTrendingMovies()` | Tendances films page 1 |
| GET | `/trending/movie/week?page=2` | `getTrendingMovies()` | Tendances films page 2 |
| GET | `/trending/tv/week?page=1` | `getTrendingTv()` | Tendances séries page 1 |
| GET | `/trending/tv/week?page=2` | `getTrendingTv()` | Tendances séries page 2 |
| GET | `/movie/popular?page=1` | `getPopularMovies()` | Films populaires page 1 (si pas de genre) |
| GET | `/movie/popular?page=2` | `getPopularMovies()` | Films populaires page 2 (si pas de genre) |
| GET | `/tv/popular?page=1` | `getPopularTv()` | Séries populaires page 1 (si pas de genre) |
| GET | `/tv/popular?page=2` | `getPopularTv()` | Séries populaires page 2 (si pas de genre) |
| GET | `/discover/movie?with_genres=<id>&page=1-4` | `discoverByGenre()` | Découverte films par genre (4 pages, si genre sélectionné) |
| GET | `/discover/tv?with_genres=<id>&page=1-4` | `discoverByGenre()` | Découverte séries par genre (4 pages, si genre sélectionné) |
| GET | `/genre/movie/list` | `getMovieGenres()` | Liste des genres films |
| GET | `/genre/tv/list` | `getTvGenres()` | Liste des genres séries |
| GET | `/<type>/<id>/videos` | `getVideos()` | Vidéos d'un média (appelé N fois via `filterWithContent`) |

Tous les appels utilisent `language=fr-FR` et `api_key=TMDB_API_KEY` (côté serveur uniquement).

## Patterns identifiés

- **Server Component orchestrateur avec vagues parallèles** : `app/page.tsx` utilise deux `Promise.all` successifs — le second dépend des résultats du premier (le hero notamment). Maximise la parallélisation tout en respectant les dépendances de données.
- **Cache HTTP natif Next.js** : tous les appels TMDB passent par `fetch` avec `{ next: { revalidate: 3600 } }`. Next.js déduplique les requêtes identiques dans le même rendu et met en cache les réponses 1 heure. Aucune bibliothèque de cache tierce.
- **URL comme source de vérité du filtre** : l'état du filtre (type, genre) est encodé dans les `searchParams` de l'URL. Le Server Component reçoit ces params à chaque requête, ce qui rend la page bookmarkable et partageble. La FilterBar lit l'état via `useSearchParams()` côté client et navigue via `router.push()`.
- **`useTransition` pour la navigation non-bloquante** : la FilterBar utilise `startTransition(() => router.push(...))` pour déclencher la navigation sans bloquer le thread UI, avec feedback visuel (`isPending` → opacité 60%).
- **Scroll circulaire dans FilterBar** : les flèches de navigation de la FilterBar implémentent un scroll circulaire — arrivé à la fin de la liste, la flèche droite revient au début, et inversement pour la flèche gauche.
- **Filtre de contenu N+1** : `filterWithContent` appelle `getVideos()` pour chaque item reçu en parallèle (`Promise.all` interne). Sur 40 items (2 pages × 20 résultats), cela génère jusqu'à 40 appels TMDB /videos simultanés par rangée, soit jusqu'à ~120 appels /videos supplémentaires sur la home sans cache froid (3 rangées). Le cache Next.js atténue cet impact en production.
- **Déduplication par `Set<number>`** : la fonction `dedup()` filtre les doublons d'id TMDB introduits par la pagination multi-pages.
- **Rendu conditionnel des rangées** : la présence de chaque rangée (`type !== 'tv'` pour films, `type !== 'movie'` pour séries) est évaluée côté serveur à chaque requête.

## Décisions hors-ADR documentées ici

### Appel `getTrending()` inutilisé

Le résultat `trendingAll` (endpoint `/trending/all/week`) est chargé dans le `Promise.all` initial mais n'est jamais utilisé dans le JSX ni transmis à un composant. Il alourdit la vague de 7 appels d'un fetch superflu à chaque chargement de la home (mitigé par le cache 1h). Probable vestige d'une fonctionnalité planifiée ou retirée.

### Scroll en pas fixe dans MediaRow

`MediaRow` utilise un scroll de ±400px au clic des flèches. Ce pas fixe n'est pas adapté à la taille réelle des cards (140-180px selon breakpoint). L'implémentation est fonctionnelle mais non précise.

### Absence de gestion d'erreur explicite

En cas d'échec de l'API TMDB (hors `getVideos` du hero qui a un `.catch(() => [])`), les erreurs remontent sans boundary React. La page lèverait une erreur non interceptée si `getTrendingMovies()` ou `getPopularMovies()` échouaient.

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `__tests__/lib/tmdb.test.ts` | Fonctions utilitaires `posterUrl`, `backdropUrl`, `getTitle`, `getYear` | Existant |
| Tests des fonctions async TMDB | `getTrendingMovies`, `getTrendingTv`, `getPopularMovies`, `discoverByGenre`, `filterWithContent`, `getVideos`, `getMovieGenres`, `getTvGenres` | Absent |
| Tests des composants | `HeroBanner`, `FilterBar`, `MediaRow`, `MediaCard`, `HeroTrailerButton` | Absent |
| Tests du Server Component | `app/page.tsx` — logique de routing des searchParams | Absent |
