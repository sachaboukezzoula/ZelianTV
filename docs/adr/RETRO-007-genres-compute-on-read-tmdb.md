# RETRO-007 — Genres des médias calculés à la lecture depuis TMDB (pas de stockage en BDD)

| Champ      | Valeur                   |
|------------|--------------------------|
| Statut     | Documenté (rétro)        |
| Date       | 2026-06-24               |
| Source     | Rétro-ingénierie         |
| Features   | recommandations          |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DB-STRATEGY |
| Q1 — Coût de revert > 1j ? | OUI — passer à un modèle de genres stockés en BDD requiert : une migration de schéma sur `user_media_lists` (ajout colonne `genres jsonb`), une modification de la Server Action `toggleWatchlist` pour stocker les genres TMDB à l'ajout, et une réécriture de `getRecommendations` pour lire depuis la base plutôt que TMDB. Trois fichiers dans deux features distinctes (recommandations + listes-personnelles), effort > 1j. |
| Q2 — Non-déductible du code ? | OUI — `package.json` et le schéma BDD (`supabase/migrations/001_init.sql`) ne révèlent pas le choix de ne pas matérialiser les genres. La table `user_media_lists` stocke `tmdb_id` et `media_type` mais aucune donnée de genre. Ce choix implicite de compute-on-read n'est pas documenté ailleurs dans le code. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — concerne les specs `recommandations` (algorithme d'agrégation) et `listes-personnelles` (schéma de `user_media_lists`, Server Action `toggleWatchlist`). Toute évolution vers un modèle stocké touche les deux features. |
| Q4 — Casse un invariant si ignoré ? | OUI — un dev qui ajoute un stockage local des genres (ex. pour optimiser les perfs) sans supprimer les appels `getMediaDetail` crée une double source de vérité silencieuse. Les genres TMDB peuvent évoluer (renommage, fusion) — des recommandations calculées sur des genres BDD périmés produiraient des résultats incorrects sans erreur visible. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

La feature recommandations a été implémentée en s'appuyant uniquement sur les données stockées en base (`tmdb_id`, `media_type`) pour identifier les médias vus. Pour calculer les genres, le module appelle `getMediaDetail` sur chaque média vu au moment du rendu, plutôt que de stocker les genres lors de l'ajout à la liste `watched`.

Cette approche a probablement été choisie pour minimiser le schéma BDD (pas de colonne `genres` à maintenir) et garantir que les genres sont toujours les plus récents fournis par TMDB.

## Décision identifiée

Le module `lib/recommendations.ts` ne lit aucune donnée de genre depuis la base de données. Pour chaque média dans la liste `watched`, il appelle `getMediaDetail(tmdb_id, media_type)` via TMDB pour récupérer le tableau `genres` en temps réel. Ces genres alimentent ensuite `aggregateTopGenres`.

La table `user_media_lists` ne contient pas de colonne de genres. La migration `001_init.sql` confirme l'absence de stockage de genre.

## Conséquences observées

### Positives

- Genres toujours à jour : si TMDB modifie la classification d'un film, le calcul suivant reflète immédiatement le changement.
- Schéma BDD minimal : aucune donnée dénormalisée à synchroniser entre TMDB et la base locale.
- Isolation de la feature recommandations : aucune modification des Server Actions de la watchlist n'est nécessaire pour faire fonctionner l'algorithme.

### Négatives / Dette

- **N+1 TMDB au rendu** : pour un utilisateur avec N médias vus, N appels `getMediaDetail` sont effectués à chaque chargement de la page profil. Atténué par le cache `revalidate: 3600` de Next.js, mais impactant en premier rendu ou après expiration.
- **Dépendance à la disponibilité TMDB** : si l'API TMDB est indisponible, `Promise.allSettled` absorbe les erreurs partielles mais l'algorithme peut calculer sur un sous-ensemble de genres — dégradation silencieuse des recommandations.
- **Quotas TMDB** : pour des listes larges (ex. 100+ films vus), la consommation de quota TMDB au rendu de la page profil peut être significative.

## Recommandation

Reconsidérer à moyen terme. Stocker les genres TMDB dans `user_media_lists` au moment de l'ajout d'un média à la liste `watched` permettrait d'éliminer les N appels `getMediaDetail` lors du calcul des recommandations, au prix d'une migration de schéma et d'une modification de `toggleWatchlist`. La fraîcheur des genres TMDB n'est pas un enjeu critique pour des recommandations (les genres changent rarement) — le compute-on-read est donc une sur-contrainte non justifiée par rapport à son coût en appels réseau.
