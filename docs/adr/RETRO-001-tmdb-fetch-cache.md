# RETRO-001 — Cache TMDB via fetch natif Next.js (revalidate 1h)

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-06-24          |
| Source     | Rétro-ingénierie    |
| Features   | catalogue-home, catalogue-detail, profil, recommandations |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DB-STRATEGY |
| Q1 — Coût de revert > 1j ? | OUI — remplacer par React Query, SWR ou Redis impacterait `lib/tmdb.ts` et toutes les pages qui en dépendent (home, fiche détail, profil, recommandations), avec refonte complète de la stratégie de revalidation et probablement du passage des données aux composants |
| Q2 — Non-déductible du code ? | OUI — `package.json` ne contient aucune lib de cache externe. La décision de déléguer le cache au mécanisme natif `fetch` de Next.js (`{ next: { revalidate: 3600 } }`) plutôt qu'une solution dédiée (Redis, React Query, Varnish) est une intention architecturale invisible dans les fichiers de config |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — catalogue-home (7 appels vague 1 + N appels filterWithContent), catalogue-detail (getMediaDetail + getVideos + getCredits), profil (enrichissement lazy des items watchlist via getMediaDetail), recommandations (discoverByGenre dans getRecommendations) |
| Q4 — Casse un invariant si ignoré ? | OUI — un dev qui remplace `fetch` natif par `axios` ou une lib non compatible avec le Data Cache Next.js casse silencieusement la mise en cache : chaque rendu page génère des appels TMDB directs, pouvant épuiser le quota API et dégrader les performances de façon non évidente |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

L'API TMDB est l'unique source de données de ZelianTV. La page d'accueil génère entre 13 et 21 appels TMDB par rendu (7 en vague 1, jusqu'à ~120 appels `/videos` via `filterWithContent` sur 3 rangées × 40 items). Sans cache, chaque visiteur déclencherait ces appels, risquant de saturer le quota gratuit TMDB (40 req/s) et de dégrader les temps de chargement. Le projet n'a pas de backend BFF dédié ni d'infrastructure de cache externe (Redis, CDN).

## Décision identifiée

Tous les appels TMDB passent par le `fetch` natif Node.js/Next.js avec l'option `{ next: { revalidate: 3600 } }` (TTL 1 heure). Next.js met en cache les réponses dans son Data Cache (système de cache HTTP étendu côté serveur). Les requêtes identiques dans le même arbre de rendu sont dédupliquées automatiquement (Request Memoization Next.js). Cette stratégie est centralisée dans la fonction `fetchTMDB()` de `lib/tmdb.ts` — toutes les fonctions du client TMDB en héritent.

## Conséquences observées

### Positives

- Aucune dépendance externe pour le cache — zéro infrastructure supplémentaire à maintenir
- Déduplication automatique des requêtes identiques dans le même rendu (ex. `getVideos` appelé plusieurs fois pour le même id)
- TTL uniforme de 1h sur toute la surface TMDB — facile à raisonner
- Compatible avec le déploiement Vercel (le Data Cache est persisté entre les requêtes)

### Négatives / Dette

- **Pas de granularité par endpoint** : les données très populaires (tendances) et les données peu consultées (détail d'un film rare) partagent le même TTL de 1h. Un découplage par endpoint permettrait d'optimiser (ex. tendances : 15min, détails : 24h)
- **N+1 appels `/videos` non amortis à froid** : `filterWithContent` génère jusqu'à 40 appels parallèles `/videos` par rangée au premier rendu. Après le premier appel, le cache prend le relais, mais un restart ou une invalidation du Data Cache déclenche un burst d'appels simultanés
- **Pas de fallback en cas d'invalidation de cache** : si TMDB est indisponible au moment de la revalidation, les pages tombent en erreur (pas de stale-while-revalidate explicite, même si Next.js peut gérer ce cas implicitement selon la version)
- **Opacité du cache** : il n'y a pas de mécanisme d'invalidation manuelle (ex. `revalidateTag`) ni de monitoring de hit/miss rate

## Recommandation

Garder — la stratégie est appropriée pour un projet de cette taille sans infrastructure dédiée. Considérer à terme :
1. Différencier le TTL par type d'endpoint (tendances plus courtes, détails plus longues) via `revalidate` par appel
2. Ajouter `unstable_cache` ou `revalidateTag` pour permettre une invalidation ciblée sans restart serveur
3. Monitorer le quota TMDB pour vérifier que le cache absorbe bien la charge en production
