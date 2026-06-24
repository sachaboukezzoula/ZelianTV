# Spec Fonctionnelle — catalogue-home [DRAFT — à valider par le dev]

| Champ      | Valeur              |
|------------|---------------------|
| Module     | catalogue-home      |
| Version    | 0.1.0               |
| Date       | 2026-06-24          |
| Auteur     | retro-documenter    |
| Statut     | DRAFT               |
| Source     | Rétro-ingénierie    |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| ADR | Titre | Catégorie | Statut |
|-----|-------|-----------|--------|
| [RETRO-001](../../adr/RETRO-001-tmdb-fetch-cache.md) | Cache TMDB via fetch natif Next.js (revalidate 1h) | DB-STRATEGY | Documenté (rétro) |

---

## Contexte et objectif

La page d'accueil de ZelianTV est le point d'entrée principal de l'application. Elle présente aux utilisateurs un catalogue de films et séries issu de l'API TMDB, sans nécessiter de connexion. L'objectif est de donner une expérience de navigation intuitive proche des plateformes de streaming commerciales : un média mis en avant (hero), des filtres rapides, et des rangées de contenu scrollables.

## Règles métier (déduites du code)

1. **Filtre de type par défaut** : en l'absence de paramètre `?type=`, le catalogue affiche les films (`movie` est la valeur par défaut dans `searchParams`).
2. **Cohabitation film/série** : quand le type actif est `movie`, la rangée "Séries populaires" est masquée. Quand le type est `tv`, la rangée "Films populaires" est masquée. La rangée "Tendances" reste toujours visible.
3. **Hero dynamique selon le type** : le HeroBanner affiche le premier élément des tendances hebdomadaires correspondant au type sélectionné (`trendingMovies[0]` ou `trendingTv[0]`).
4. **Filtrage par genre** : le paramètre `?genre=<id>` remplace les listes populaires par des appels `discoverByGenre`. Si aucun genre n'est sélectionné, les endpoints `/movie/popular` et `/tv/popular` sont utilisés.
5. **Réinitialisation du genre au changement de type** : lorsque l'utilisateur bascule entre Film et Série dans la FilterBar, le paramètre `?genre=` est automatiquement supprimé de l'URL.
6. **Filtre de contenu (trailer obligatoire)** : seuls les médias disposant d'au moins un trailer YouTube (via l'endpoint `/videos`) sont inclus dans les rangées affichées. Les médias sans overview sont aussi exclus en amont.
7. **Hero sans trailer** : si aucun trailer n'est trouvé pour le média hero, le bouton "Trailer" redirige vers la fiche détail du média (`/media/<type>-<id>`) plutôt que d'ouvrir un player.
8. **Déduplication** : les fonctions `getTrendingMovies`, `getTrendingTv`, `getPopularMovies`, `getPopularTv` et `discoverByGenre` effectuent une déduplication par `id` TMDB sur les résultats multi-pages.
9. **Pagination TMDB** : les tendances et populaires sont chargées sur 2 pages TMDB. La découverte par genre charge 4 pages.
10. **Genres contextuels** : la liste de genres affichée dans la FilterBar correspond au type sélectionné — genres films (`/genre/movie/list`) ou genres séries (`/genre/tv/list`).
11. **Rangée vide masquée** : si une rangée `MediaRow` reçoit un tableau vide (ex. aucun film avec trailer pour un genre donné), elle ne s'affiche pas.

## Cas d'usage (déduits)

### CU-001 — Navigation initiale (page d'accueil sans paramètre)

L'utilisateur accède à `/`. La page charge en parallèle les tendances hebdomadaires toutes catégories, les tendances films (2 pages), les tendances séries (2 pages), les films populaires (2 pages), les séries populaires (2 pages), et les listes de genres. Le premier film tendance est affiché dans le HeroBanner avec son trailer si disponible. La FilterBar affiche le toggle Film/Série (Film actif) et les pills de genres films. Les rangées "Tendances" et "Films populaires" sont affichées.

### CU-002 — Filtrage par type (bascule vers Séries)

L'utilisateur clique sur "Série" dans la FilterBar. La navigation vers `/?type=tv` est déclenchée via `router.push` dans un `useTransition`. La FilterBar passe en état `isPending` (opacité réduite). La page se recharge côté serveur avec le type `tv` : le hero bascule sur `trendingTv[0]`, la FilterBar affiche les genres séries, les rangées "Tendances" (séries) et "Séries populaires" apparaissent, la rangée "Films populaires" disparaît. Le paramètre `genre` est réinitialisé.

### CU-003 — Filtrage par genre

L'utilisateur clique sur une pill de genre dans la FilterBar. La navigation vers `/?type=<type>&genre=<id>` est déclenchée. Les rangées de médias sont remplacées par les résultats de `discoverByGenre` pour le genre sélectionné, filtrés par la présence d'un trailer. Cliquer à nouveau sur la même pill de genre la désactive (toggle : si `genreId === String(g.id)`, le paramètre est supprimé).

### CU-004 — Lecture du trailer hero

L'utilisateur clique sur "Trailer" dans le HeroBanner. Si un trailer YouTube est disponible, une modale s'ouvre avec l'iframe YouTube en autoplay. La modale est fermable en cliquant en dehors, en cliquant "Fermer", ou en appuyant sur Échap. Le scroll de la page est bloqué (`body.overflow = 'hidden'`) pendant l'ouverture.

### CU-005 — Navigation vers la fiche détail

L'utilisateur clique sur une MediaCard dans une rangée, ou sur "Voir les détails" dans le HeroBanner. Il est redirigé vers `/media/<type>-<id>` (feature catalogue-detail).

## Dépendances

- `lib/tmdb.ts` — client TMDB, fonctions de fetch et utilitaires d'affichage
- `components/MediaCard.tsx` — carte poster utilisée dans les MediaRow
- `components/YoutubePlayer.tsx` — non utilisé sur la home (voir feature catalogue-detail)
- Feature `catalogue-detail` — destination des liens MediaCard et HeroBanner
- API externe TMDB v3 — source unique de données pour cette feature

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Intention de `getTrending()` non utilisé** : la fonction `getTrending()` (endpoint `/trending/all/week`) est importée et appelée dans `Promise.all` mais son résultat est affecté à `trendingAll` qui n'est jamais utilisé dans le rendu. Il s'agit peut-être d'un résidu d'une version antérieure ou d'une donnée réservée pour un futur usage (recommandations globales ?).
- **Choix du premier élément pour le hero** : le hero est toujours `trendingMovies[0]` ou `trendingTv[0]`. Il n'y a pas de logique de sélection basée sur la note, la popularité ou la disponibilité du backdrop. Ce comportement est-il intentionnel ou une simplification provisoire ?
- **Absence de pagination côté client** : les rangées affichent tous les résultats filtrés sans pagination ni "voir plus". Est-ce un choix définitif ou une fonctionnalité prévue ?
- **Comportement sans résultat** : si `filterWithContent` retourne un tableau vide pour tous les médias (ex. TMDB indisponible), la page affiche uniquement le HeroBanner sans rangées. Il n'y a pas de message d'erreur explicite pour l'utilisateur.
