# Plan de Remédiation — ZelianTV

> Source : audit initial du 2026-06-24 — dette-technique.md

---

## Stratégie

Traiter d'abord les deux blocants critiques (BDD cassée, log en production) qui empêchent une mise en production saine, puis sécuriser les flux de compte utilisateur qui présentent des risques fonctionnels et de sécurité, puis réduire les dettes de performance liées aux patterns N+1 TMDB qui deviendront problématiques à l'échelle. Les améliorations d'UX et de qualité (accessibilité, messages d'erreur, tests) sont traitées en opportunité lors des sprints suivants.

---

## Phase 1 — Corrections critiques (Sprint 1)

> Objectif : état "prêt pour la mise en production" sur les fonctionnalités existantes.

| # | Action | Réf. dette | Feature | Effort estimé | Prérequis |
|---|--------|-----------|---------|--------------|-----------|
| 1.1 | Supprimer la contrainte `CHECK (list_type IN ('watchlist', 'watched'))` de `user_media_lists` via une nouvelle migration Supabase. La contrainte doit être remplacée par une validation applicative (liste de valeurs réservées dans le code) si la restriction sur les noms de listes fixes est souhaitée. | C-1 | listes-personnelles | XS | Accès Supabase CLI ou dashboard de l'instance de dev |
| 1.2 | Supprimer les lignes 7-10 de `lib/supabase/admin.ts` (le bloc `console.log` qui décode et logue le JWT service_role). Vérifier qu'aucun autre `console.log` n'est présent dans les fichiers `lib/supabase/` et `app/actions/`. | C-2 | Toutes (Server Actions) | XS | Aucun |
| 1.3 | Implémenter la page de saisie du nouveau mot de passe pour le flux de réinitialisation : détecter le token de reset dans l'URL (`?type=recovery&access_token=...`) sur `/profil` et afficher un formulaire dédié à la place de `AuthTabs`. | M-1 | auth | M | Aucun (test manuel avec un vrai email de reset) |
| 1.4 | Supprimer l'appel `getTrending()` inutilisé de `app/page.tsx` (affecté à `trendingAll` sans utilisation). | M-8 | catalogue-home | XS | Aucun |

---

## Phase 2 — Stabilisation sécurité et fiabilité (Sprints 2-3)

> Objectif : sécuriser les flux sensibles et corriger les comportements incohérents avant toute ouverture au public.

| # | Action | Réf. dette | Feature | Effort estimé | Prérequis |
|---|--------|-----------|---------|--------------|-----------|
| 2.1 | Ajouter une re-vérification de l'email actuel dans `changeEmailAction` : exiger que l'utilisateur saisisse son mot de passe (ou son email actuel) pour confirmer la modification. Changer le comportement de `updateUserById` pour passer `email_confirm: false` et envoyer un email de vérification à la nouvelle adresse plutôt que de valider immédiatement. | M-2 | profil-utilisateur, auth | M | Clarification du comportement attendu avec le dev (email de confirmation ou vérification mot de passe ?) |
| 2.2 | Implémenter le rollback sur les optimistic updates dans `WatchlistButton` : conserver l'état précédent avant la mise à jour optimiste, détecter l'échec de la Server Action et restaurer l'état antérieur avec un message d'erreur toast. | M-7 | listes-personnelles | S | Aucun |
| 2.3 | Ajouter la validation MIME côté serveur dans `uploadAvatarAction` : vérifier les magic bytes du buffer reçu (ou au minimum que la taille ne dépasse pas un seuil raisonnable) avant l'upload vers Supabase Storage. | m-4 | upload-avatar | S | Aucun |
| 2.4 | Clarifier le statut de `user_preferences` et de la colonne `rating` : décider si ces données sont prévues pour une fonctionnalité future documentée ou abandonnées. Si abandonnées, supprimer les lectures dans `app/profil/page.tsx` et envisager une migration de suppression. | m-1, M-6 | profil-utilisateur, listes-personnelles | S | Décision produit sur la roadmap |
| 2.5 | Traduire les messages d'erreur GoTrue en français et les catégoriser par code d'erreur (`AuthApiError.code`) plutôt que d'afficher `error.message` directement. | m-9 | auth | S | Liste des codes GoTrue pertinents (`invalid_credentials`, `user_already_exists`, etc.) |
| 2.6 | Ajouter un message d'erreur visible dans `SearchBar` pour distinguer "aucun résultat" d'une erreur réseau / TMDB indisponible. | m-2 | recherche-live | XS | Aucun |
| 2.7 | Aligner le comportement mobile et desktop sur la fiche détail quand aucun trailer n'est disponible : afficher un message "Aucun trailer disponible" sur mobile comme sur desktop. | m-3 | fiche-detail | XS | Aucun |

---

## Phase 3 — Amélioration continue (Sprints 4+)

> Objectif : réduire la dette de performance, améliorer la qualité et préparer les évolutions futures.

| # | Action | Réf. dette | Feature | Effort estimé | Prérequis |
|---|--------|-----------|---------|--------------|-----------|
| 3.1 | Stocker les genres TMDB dans `user_media_lists` lors de l'ajout à la liste `watched` (nouvelle colonne `genres jsonb`). Modifier `toggleWatchlist` pour inclure les genres au moment de l'upsert. Réécrire `getRecommendations` pour lire les genres depuis la BDD plutôt que TMDB. Cela élimine le N+1 M-4 et une partie du M-5. | M-4, M-5 | recommandations, listes-personnelles | L | Migration Supabase, écrire un ADR BREAKING-CHANGE si la contrainte UNIQUE est impactée |
| 3.2 | Évaluer et optimiser `filterWithContent` : envisager de pré-filtrer les médias TMDB par critère de popularité avant d'appeler `/videos`, ou de mettre en cache les ids de médias "avec trailer" en dehors du Data Cache Next.js pour réduire le burst au premier rendu. | M-3 | catalogue-home | L | Analyser les données réelles de popularité TMDB + mesurer le quota consommé en production |
| 3.3 | Différencier le TTL de cache TMDB par type d'endpoint dans `lib/tmdb.ts` : tendances (15min), fiches détail (24h), genres (48h). Utiliser `revalidateTag` pour permettre une invalidation ciblée. | m-7 | catalogue-home, fiche-detail, recommandations | M | Aucun (changement localisé dans `fetchTMDB`) |
| 3.4 | Ajouter un type `UserProfile` partagé pour remplacer les castings manuels de `user_metadata`. | m-5 | profil-utilisateur, upload-avatar | S | Aucun |
| 3.5 | Implémenter la navigation clavier dans `SearchBar` (flèches haut/bas, Échap, `aria-*`) pour atteindre un niveau minimal d'accessibilité WCAG. | m-10 | recherche-live | S | Aucun |
| 3.6 | Ajouter des tests E2E Playwright sur les flux critiques : connexion, ajout à la watchlist, modification du profil, upload avatar. Viser une couverture E2E sur les 5 features actuellement non testées. | m-6 | auth, listes-personnelles, profil-utilisateur, upload-avatar, fiche-detail | L | Setup Playwright dans le projet (pas de Playwright actuellement) |
| 3.7 | Valider les 8 specs DRAFT avec le dev responsable et retirer le tag DRAFT. Documenter les décisions sur les zones d'incertitude (23 identifiées dans les specs). | — | Toutes | M | Disponibilité du dev responsable du projet |
| 3.8 | Encapsuler la modification du pseudo dans une Server Action (actuellement appel direct `supabase.auth.updateUser` depuis le Client Component) pour ajouter une validation serveur de longueur et de format. | m-5 | profil-utilisateur | S | Aucun |

---

## Dépendances entre actions

```
1.1 (contrainte BDD)
  └─ aucune dépendance amont — peut être fait en premier

1.2 (console.log)
  └─ aucune dépendance amont — peut être fait en premier

1.3 (flux reset password)
  └─ aucune dépendance amont

1.4 (supprimer getTrending inutilisé)
  └─ aucune dépendance amont

2.1 (sécuriser changeEmail) → doit précéder toute ouverture au public
2.4 (clarifier user_preferences / rating) → décision produit requise avant 3.1

3.1 (stocker genres en BDD) → dépend de :
  - 1.1 (la contrainte BDD corrigée)
  - 2.4 (décision sur le schéma clarifiée)
  - Écriture d'un ADR avant implémentation (breaking change sur user_media_lists)

3.2 (optimiser filterWithContent) → peut être fait indépendamment, mais :
  - Mesurer le quota TMDB réel en production avant de prioriser
  - Plus impactant si 3.3 (TTL différencié) est fait d'abord

3.3 (TTL différencié) → peut être fait indépendamment à tout moment

3.6 (tests E2E) → doit être fait après 1.1 + 1.3 (les flux à tester doivent être corrigés)

3.7 (valider les specs DRAFT) → peut être fait en parallèle de la Phase 2
```

---

## Résumé des efforts par phase

| Phase | Nb actions | Effort total estimé | Durée indicative |
|-------|-----------|---------------------|-----------------|
| Phase 1 | 4 | 2XS + 1M + 1XS = ~2j | Sprint 1 (1 semaine) |
| Phase 2 | 7 | 1M + 1S + 1S + 1S + 1S + 1XS + 1XS = ~5j | Sprints 2-3 (2-3 semaines) |
| Phase 3 | 8 | 1L + 1L + 1M + 1S + 1S + 1L + 1M + 1S = ~10-15j | Sprints 4+ (continu) |

> Légende efforts : XS = < 2h, S = demi-journée, M = 1-2 jours, L = 3-5 jours
