# Audit Initial — ZelianTV

| Champ             | Valeur              |
|-------------------|---------------------|
| Date              | 2026-06-24          |
| Auditeur          | retro-auditor       |
| Source            | Rétro-ingénierie    |
| Features auditées | 8                   |
| ADRs identifiés   | 7                   |

---

## Résumé exécutif

ZelianTV est une application Next.js 16 (App Router) full-TypeScript connectée à Supabase (PostgreSQL + Auth + Storage) et à l'API TMDB, sans backend séparé. L'architecture est cohérente et les patterns fondamentaux (RLS, client admin/anon, Server Actions, cache fetch natif) sont correctement appliqués sur l'ensemble des 8 features. Le point fort principal est la solidité de la sécurité des données utilisateur, grâce au double niveau RLS + bypass contrôlé. Le risque le plus urgent est une incompatibilité critique entre la contrainte BDD `CHECK (list_type IN ('watchlist', 'watched'))` et les listes custom, qui rendrait les données de listes personnalisées impossibles à persister en production. Une violation active de la règle Zelian #4 (`console.log` en production dans `lib/supabase/admin.ts`) constitue également un problème bloquant à corriger immédiatement.

---

## Stack et architecture

**Framework :** Next.js 16.2.9 — App Router, sans dossier `src/`, alias `@/` racine. TypeScript 5 strict mode.

**Données :** Supabase (PostgreSQL managé) via Supabase JS SDK v2 — pas d'ORM classique. Deux niveaux de client : `anon` (RLS active, lecture + vérification d'identité) et `service_role` (bypass RLS contrôlé dans les Server Actions uniquement).

**Auth :** Supabase GoTrue (email/password). Sessions cookiées SSR via `@supabase/ssr`. Rafraîchissement systématique dans `proxy.ts` (middleware Next.js).

**API externe :** TMDB v3 côté serveur uniquement. Cache via `fetch` natif Next.js (`revalidate: 3600` — 1h). Pas de lib de cache dédiée.

**UI :** Tailwind CSS v4, design system dark custom via variables CSS, police Geist Sans. State local React + Context API (`ListsProvider`).

**Tests :** Jest 30 + @testing-library/react 16. 4 fichiers de test dans `__tests__/` (~14 tests). Couverture partielle.

**Pattern architectural dominant :** Server Components pour les rendus de données, Server Actions pour les mutations (pattern `getAuthUser()` + `createAdminClient()` systématique), Client Components pour l'interactivité. Optimistic updates côté client sans rollback.

---

## Cartographie fonctionnelle

| # | Feature | État | Complexité | Tests | Spec |
|---|---------|------|-----------|-------|------|
| 1 | catalogue-home | Fonctionnel | Haute | Partiel (lib/tmdb) | docs/specs/catalogue-home/ |
| 2 | recherche-live | Fonctionnel | Faible | Non | docs/specs/recherche-live/ |
| 3 | fiche-detail | Fonctionnel | Moyenne | Non | docs/specs/fiche-detail/ |
| 4 | listes-personnelles | Partiel (bug BDD critique) | Haute | Partiel (watchlist actions) | docs/specs/listes-personnelles/ |
| 5 | auth | Fonctionnel | Moyenne | Non | docs/specs/auth/ |
| 6 | profil-utilisateur | Fonctionnel | Haute | Non | docs/specs/profil-utilisateur/ |
| 7 | upload-avatar | Fonctionnel | Moyenne | Non | docs/specs/upload-avatar/ |
| 8 | recommandations | Fonctionnel (perfs limitées) | Haute | Partiel (recommendations algo) | docs/specs/recommandations/ |

**Note sur l'état "Partiel" de listes-personnelles :** la feature est fonctionnelle pour les deux listes fixes (`watchlist`, `watched`) mais les listes custom échouent silencieusement si la contrainte `CHECK (list_type IN ('watchlist', 'watched'))` de `supabase/migrations/001_init.sql` est active en production. La fonctionnalité principale étant les listes custom, l'état est évalué comme partiel.

---

## Points forts

1. **Sécurité des données utilisateur bien architecturée.** Le double niveau RLS (filet BDD) + client admin contrôlé (bypass explicite après vérification d'identité) est le pattern Supabase recommandé. La `SUPABASE_SERVICE_ROLE_KEY` n'est jamais exposée côté client. Le pattern `getAuthUser()` + `createAdminClient()` est cohérent sur toutes les Server Actions.

2. **Architecture Next.js App Router conforme et lisible.** La séparation Server Components / Client Components / Server Actions / Route Handlers est nette. Les Server Components chargent les données, les Server Actions gèrent les mutations, les Client Components gèrent l'interactivité. La structure `app/` / `components/` / `lib/` / `actions/` est cohérente et nommée correctement.

3. **Cache TMDB sans infrastructure externe.** L'usage du `fetch` natif Next.js avec `revalidate: 3600` couvre les 4 features consommatrices d'API (home, fiche, profil, recommandations) sans Redis ni CDN. La déduplication automatique des requêtes dans le même rendu est un bénéfice supplémentaire.

4. **Modèle de données BDD minimal et cohérent.** La contrainte `UNIQUE (user_id, tmdb_id, media_type)` est un invariant métier bien choisi : un média ne peut être que dans une liste à la fois, le changement de liste est atomique via `upsert`. Aucune donnée redondante inutile.

5. **7 ADRs valides produits, couvrant les décisions architecturales structurantes.** Tous les ADRs ont passé la politique v2.3.0 (whitelist de catégorie, checklist 4 questions, anti-patterns). Les décisions hors politique ont été correctement redirigées vers les `spec-technique.md`.

---

## Risques identifiés

| # | Risque | Criticité | Impact | Feature(s) |
|---|--------|-----------|--------|------------|
| 1 | Contrainte `CHECK (list_type IN ('watchlist', 'watched'))` en BDD incompatible avec les listes custom | CRITIQUE | Les upserts de listes custom échouent en production — toute liste personnalisée est impossible à créer ou modifier | listes-personnelles, profil-utilisateur |
| 2 | `console.log` en production dans `lib/supabase/admin.ts` (lignes 7-10) | CRITIQUE | Violation règle Zelian #4, fuite partielle du rôle JWT service_role dans les logs de production | auth, listes-personnelles, upload-avatar, profil-utilisateur (toutes les Server Actions) |
| 3 | Flux de réinitialisation de mot de passe incomplet (`redirectTo: '/profil'` sans page de saisie du nouveau mot de passe) | MAJEUR | Un utilisateur qui clique sur le lien de reset email ne peut pas définir son nouveau mot de passe — le flux est cassé fonctionnellement | auth |
| 4 | N+1 appels TMDB dans `filterWithContent` (jusqu'à 120 appels `/videos` par rendu à froid) | MAJEUR | Risque de saturation quota TMDB gratuit (40 req/s) au premier rendu ou après expiration du Data Cache | catalogue-home |
| 5 | N+1 appels TMDB dans l'enrichissement profil et les recommandations (N appels `getMediaDetail` par item `watched`) | MAJEUR | Pour un utilisateur avec 50+ films vus, le rendu de `/profil` génère 50+ appels TMDB parallèles au premier chargement — impact perfs et quotas | profil-utilisateur, recommandations |
| 6 | Colonne `rating` en BDD (`user_media_lists`) non utilisée par le code applicatif | MINEUR | Dead weight en schéma — fonctionnalité abandonnée ou prévue non documentée | listes-personnelles |
| 7 | Pas de gestion d'erreur visible à l'utilisateur pour la recherche TMDB en échec | MINEUR | Le dropdown reste vide silencieusement, sans message d'erreur ni indication de problème | recherche-live |
| 8 | Modification d'email via client admin sans re-vérification de l'email actuel (`changeEmailAction` avec `email_confirm: true`) | MAJEUR | Un attaquant avec accès à une session active peut changer l'email du compte sans validation — risque de prise de compte | profil-utilisateur, auth |
| 9 | Pas de validation MIME côté serveur pour les uploads d'avatar (uniquement `accept="image/*"` HTML) | MINEUR | Un fichier non-image renommé en `.jpg` peut être uploadé — absence de validation de contenu côté serveur | upload-avatar |
| 10 | Absence de tests E2E et de tests des Server Components | MINEUR | Couverture de test partielle — les flux critiques (auth, watchlist, profil) ne sont pas couverts end-to-end | Toutes |

---

## Recommandations stratégiques

1. **Corriger immédiatement les deux points CRITIQUE avant toute mise en production.** La contrainte BDD cassée (risque #1) et le `console.log` en production (risque #2) doivent être traités en priorité absolue. Le risque #1 est une migration SQL d'une ligne. Le risque #2 est une suppression de 4 lignes dans un fichier.

2. **Sécuriser le flux d'édition de compte avant d'ouvrir l'inscription au public.** La modification d'email sans re-vérification (risque #8) et l'absence de flux de reset de mot de passe complet (risque #3) sont des risques de sécurité et de fonctionnalité qui impactent la confiance utilisateur. À traiter en Phase 2.

3. **Auditer la consommation de quota TMDB en production avant d'accueillir des utilisateurs avec des listes larges.** Les deux patterns N+1 (risques #4 et #5) sont atténués par le cache Next.js mais peuvent dépasser le quota gratuit TMDB en conditions réelles. Instrumenter le monitoring ou implémenter le stockage des genres en BDD (ADR RETRO-007 recommande déjà cette évolution) à planifier en Phase 2-3.
