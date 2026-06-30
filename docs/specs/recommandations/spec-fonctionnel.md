# Spec Fonctionnelle — recommandations [DRAFT — à valider par le dev]

| Champ      | Valeur                   |
|------------|--------------------------|
| Module     | recommandations          |
| Version    | 0.1.0                    |
| Date       | 2026-06-24               |
| Auteur     | retro-documenter         |
| Statut     | DRAFT                    |
| Source     | Rétro-ingénierie         |

> **[DRAFT — à valider par le dev]** Cette spec a été générée par rétro-ingénierie
> à partir du code existant. Elle doit être relue et validée par un développeur
> qui connaît le contexte métier.

---

## ADRs

| # | Titre | Catégorie | Statut |
|---|-------|-----------|--------|
| [RETRO-007](../../adr/RETRO-007-genres-compute-on-read-tmdb.md) | Genres calculés à la lecture depuis TMDB (pas de stockage en BDD) | DB-STRATEGY | Documenté (rétro) |

---

## Contexte et objectif

Le module de recommandations personnalise la page profil de l'utilisateur en proposant des médias susceptibles de l'intéresser, sur la base de ses habitudes de visionnage. L'objectif est d'augmenter l'engagement en exposant des contenus pertinents sans requérir une action explicite de l'utilisateur (contrairement à la recherche ou à la watchlist).

Les recommandations sont générées entièrement côté serveur au moment du rendu de la page profil, sans persistance ni cache dédié.

## Règles métier (déduites du code)

1. **Seuls les médias marqués "déjà vu"** (`list_type === 'watched'`) alimentent le calcul des recommandations. Les médias en watchlist ou dans des listes custom sont ignorés.
2. **Le calcul est basé sur les genres TMDB** des médias vus, récupérés en temps réel via `getMediaDetail` — les genres ne sont pas stockés en base de données.
3. **Les top 3 genres les plus fréquents** dans l'historique de visionnage sont retenus pour alimenter les appels TMDB discover. Si l'utilisateur n'a aucun média vu, aucune recommandation n'est générée.
4. **Les recommandations couvrent films ET séries** : un appel `discover/movie` et un appel `discover/tv` sont lancés en parallèle avec les mêmes genres.
5. **Les médias déjà vus sont exclus** du résultat final par comparaison sur `tmdb_id` (Set en mémoire). Un média marqué "vu" ne peut pas apparaître en recommandation.
6. **Le résultat est limité à 12 médias** maximum, issus de la fusion films + séries après déduplication et exclusion.
7. **En cas d'erreur** (appel TMDB en échec, liste vide), la section recommandations affiche un message d'invite sans bloquer le rendu de la page profil (`.catch(() => [])`).
8. **L'affichage est conditionnel** : si `watched` est vide, un message invite l'utilisateur à marquer des médias comme vus. Si des recommandations existent, elles s'affichent sous forme de grille de posters cliquables renvoyant vers la fiche détail.

## Cas d'usage (déduits)

### CU-001 — Génération des recommandations à l'ouverture du profil

**Acteur** : utilisateur authentifié ayant au moins un média dans sa liste "Déjà vu"

**Pré-conditions** : session active, au moins un média avec `list_type = 'watched'` en base

**Flux principal** :
1. L'utilisateur accède à `/profil`.
2. Le Server Component charge toutes les listes de l'utilisateur depuis Supabase.
3. Les items `watched` sans `poster_path` ou `title` sont enrichis individuellement via `getMediaDetail` TMDB.
4. La fonction `getRecommendations(watched)` est appelée avec la liste enrichie.
5. Pour chaque item `watched`, un appel `getMediaDetail` récupère les genres TMDB en temps réel.
6. `aggregateTopGenres` calcule les 3 genres les plus fréquents par fréquence décroissante.
7. Deux appels parallèles `discoverByGenre` (movies + tv) récupèrent 4 pages TMDB chacun (80 résultats bruts par type).
8. Les médias déjà vus sont filtrés via `filterOutWatched`.
9. Les 12 premiers médias du résultat fusionné sont retournés et affichés en grille de posters.

**Post-conditions** : la section "Recommandations" affiche jusqu'à 12 posters cliquables.

### CU-002 — Absence de recommandations (liste vide)

**Acteur** : utilisateur sans aucun média marqué "Déjà vu"

**Flux** :
1. `getRecommendations([])` retourne immédiatement `[]` (early return).
2. La section "Recommandations" affiche : "Marquez des médias comme « Déjà vu » pour recevoir des recommandations."

### CU-003 — Erreur TMDB en cours de génération

**Flux** :
1. Un ou plusieurs appels `getMediaDetail` échouent pendant l'agrégation des genres.
2. `Promise.allSettled` absorbe les erreurs partielles — seuls les médias dont le détail a pu être récupéré contribuent au calcul des genres.
3. Si l'appel `getRecommendations` lève une erreur globale, le `.catch(() => [])` dans `page.tsx` retourne un tableau vide sans bloquer la page.

## Dépendances

- **`lib/tmdb.ts`** — fonctions `getMediaDetail` (enrichissement + récupération genres) et `discoverByGenre` (discover TMDB paginé sur 4 pages)
- **`app/actions/watchlist.ts`** (indirect) — alimente la table `user_media_lists` dont dépend la liste `watched`
- **`app/profil/page.tsx`** — orchestre l'appel à `getRecommendations` côté serveur
- **`app/profil/ProfileClient.tsx`** — rendu de la section Recommandations (grille de posters)
- **Supabase `user_media_lists`** — source des médias vus (`list_type = 'watched'`)
- **TMDB API v3** — `/movie/{id}`, `/tv/{id}`, `/discover/movie`, `/discover/tv`

## Zones d'incertitude

> Les points suivants n'ont pas pu être déterminés par le code seul :

- **Pertinence du top-3 genres** : le choix de 3 genres (paramètre `topN = 3` par défaut) est arbitraire dans le code. Le critère de sélection du seuil optimal n'est pas documenté.
- **Ordre de priorité films vs séries** : le résultat final fusionne `[...movies, ...series]` — les films apparaissent donc systématiquement avant les séries dans les 12 suggestions. Ce comportement est-il intentionnel ?
- **Pas de déduplication films/séries** : un même contenu ne peut pas apparaître deux fois dans le résultat (films et séries sont des types distincts), mais `dedup` dans `tmdb.ts` est appliqué au niveau de chaque appel `discoverByGenre`, pas sur la fusion finale. À valider.
- **Fréquence de rafraîchissement** : les recommandations sont recalculées à chaque chargement de la page profil — pas de TTL ni de mise en cache dédiée. Impact sur les quotas TMDB non évalué pour des listes larges.
- **Genres multi-types** : les genres TMDB films et séries ont des IDs partiellement communs (ex : Action = 28 pour les deux) mais pas identiques pour tous. L'algorithme traite film et série sans distinction de type de genre. Comportement intentionnel ?
