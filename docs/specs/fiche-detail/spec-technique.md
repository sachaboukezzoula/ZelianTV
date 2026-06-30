# Spec Technique — fiche-detail

| Champ         | Valeur              |
|---------------|---------------------|
| Module        | fiche-detail        |
| Version       | 0.1.0               |
| Date          | 2026-06-24          |
| Source        | Rétro-ingénierie    |

## Architecture du module

La feature repose sur un seul Server Component async (`app/media/[id]/page.tsx`) qui orchestre l'intégralité du cycle de données et délègue le rendu des zones interactives à trois Client Components.

**Flux de données :**

```
app/media/[id]/page.tsx  (Server Component async)
  │
  ├── parseId(id)  →  { type: 'movie'|'tv', tmdbId: number }  |  null → notFound()
  │
  ├── Promise.all(
  │     getMediaDetail(tmdbId, type)   →  Media  |  null → notFound()
  │     getVideos(tmdbId, type)        →  Video[] (filtrés YouTube Trailer)  |  []
  │     getCredits(tmdbId, type)       →  CastMember[] (max 10)  |  []
  │   )
  │
  ├── Calculs serveur
  │     title   = getTitle(media)
  │     year    = getYear(media)
  │     runtime = format selon type (movie: Xh Ymin / tv: ~Xmin/ép.)
  │     trailer = videos[0]  (undefined si vide)
  │
  ├── Layout MOBILE  (visible < lg, rendu SSR)
  │     Backdrop + Image poster
  │     Genres pills, Note, WatchlistButton (Client)
  │     Synopsis
  │     YoutubePlayer (Client) — si trailer présent
  │     Distribution — scroll horizontal, initiales si pas de photo
  │
  └── Layout DESKTOP  (visible >= lg, rendu SSR)
        Colonne gauche : PosterPlayer (Client) — poster cliquable si trailer
        Colonne droite : titre, note ×2 (même valeur), genres, synopsis, distribution grille
```

**generateMetadata** effectue un appel `getMediaDetail` indépendant (dédupliqué par le Request Memoization Next.js si le composant page s'exécute dans le même cycle de rendu).

## Fichiers impactés

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `app/media/[id]/page.tsx` | Server Component principal — parsing, fetches, deux layouts | ~234 |
| `components/YoutubePlayer.tsx` | Client Component — lazy-load iframe YouTube (mobile) | ~38 |
| `components/PosterPlayer.tsx` | Client Component — poster + modale YouTube (desktop) | ~98 |
| `components/WatchlistButton.tsx` | Client Component partagé — dropdown ajout aux listes | ~(voir feature listes) |
| `lib/tmdb.ts` | Client TMDB — `getMediaDetail`, `getVideos`, `getCredits`, helpers url/title/year | ~167 |

## Schéma BDD

Non applicable directement à cette feature. La fiche détail est entièrement read-only depuis TMDB. La seule interaction BDD est déléguée au `WatchlistButton` (feature listes-personnelles, table `user_media_lists`).

## API / Endpoints TMDB consommés

| Méthode | Route TMDB | Fonction | Cache |
|---------|------------|----------|-------|
| GET | `/movie/{id}` ou `/tv/{id}` | `getMediaDetail` | 1h (RETRO-001) |
| GET | `/movie/{id}/videos` ou `/tv/{id}/videos` | `getVideos` | 1h (RETRO-001) |
| GET | `/movie/{id}/credits` ou `/tv/{id}/credits` | `getCredits` | 1h (RETRO-001) |

Tous les appels utilisent `language=fr-FR`. Le filtre `site === 'YouTube' && type === 'Trailer'` est appliqué dans `getVideos` avant retour.

## Patterns identifiés

- **Dual-layout SSR par breakpoint** : les deux layouts mobile et desktop sont rendus simultanément côté serveur. La différenciation est purement CSS (`lg:hidden` / `hidden lg:grid`). Cela double le HTML envoyé au client mais évite tout hydration mismatch ou layout shift. Conséquence : les deux layouts consomment la même donnée serveur.
- **Lazy-load manuel du player YouTube** : `YoutubePlayer` affiche un bouton play statique jusqu'au clic utilisateur, puis monte l'iframe avec `autoplay=1`. Cela évite le chargement automatique des scripts YouTube (performance, RGPD implicite).
- **Modale YouTube via state local** : `PosterPlayer` gère l'ouverture/fermeture de la modale via `useState(false)`. L'overflow du `body` est verrouillé (`overflow: hidden`) pendant que la modale est ouverte, restauré au démontage via le return du `useEffect`.
- **Initiales comme fallback avatar** : lorsque `profile_path` est null, le composant extrait les initiales (`name.split(' ').map(n => n[0]).slice(0, 2).join('')`). Ce calcul est fait inline dans le JSX sans utilitaire dédié.
- **Fetch parallèle + catch isolé** : `Promise.all` avec `.catch(() => null)` sur `getMediaDetail` et `.catch(() => [])` sur `getVideos`/`getCredits`. Un 404 TMDB sur le détail déclenche `notFound()`, une erreur sur vidéos ou crédits est silencieuse.

## Décisions techniques documentées ici (hors ADR)

- **Note "critique" vs "public" en doublon** : le layout desktop affiche deux blocs "Note critique" et "Note public" qui affichent tous deux `media.vote_average.toFixed(1)`. L'API TMDB ne fournit qu'une seule note agrégée. Il s'agit d'un placeholder UI non fonctionnel à compléter ou supprimer.
- **Pas de `character` dans l'affichage distribution** : l'interface `CastMember` inclut le champ `character` (rôle joué) mais il n'est pas affiché dans l'UI. Seul le nom de l'acteur est visible.
- **`generateMetadata` fait un appel TMDB dédié** : bien que Next.js déduplique les requêtes identiques via Request Memoization, `generateMetadata` exécute `getMediaDetail` indépendamment. Si l'ordre d'exécution diffère, deux appels réseau réels peuvent être émis lors du premier rendu (avant que le cache Data Cache soit chaud).
- **Hauteur du backdrop codée en dur par breakpoint** : `h-[180px] sm:h-[260px] md:h-[360px] lg:h-[480px]`. Pas de variable CSS ni de token de design system — valeur responsive définie dans le JSX.

## Tests existants

| Fichier | Ce qu'il teste | Statut |
|---------|---------------|--------|
| `__tests__/lib/tmdb.test.ts` | `getMediaDetail`, `getVideos`, `getCredits` (mocking `fetch`) | Existant |
| — | `app/media/[id]/page.tsx` (Server Component) | Absent |
| — | `YoutubePlayer` (lazy-load, rendu iframe) | Absent |
| — | `PosterPlayer` (modale, Échap, click outside) | Absent |
