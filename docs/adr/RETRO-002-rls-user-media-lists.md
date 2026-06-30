# RETRO-002 — RLS et isolation utilisateur sur user_media_lists

| Champ      | Valeur                  |
|------------|-------------------------|
| Statut     | Documenté (rétro)       |
| Date       | 2026-06-24              |
| Source     | Rétro-ingénierie        |
| Features   | listes-personnelles, profil |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | SECURITY |
| Q1 — Coût de revert > 1j ? | OUI — désactiver le RLS ou modifier les politiques nécessite un audit de toutes les Server Actions qui accèdent à `user_media_lists`, une revue de la stratégie client (anon vs admin), et une vérification que les données d'un utilisateur ne deviennent pas lisibles par un autre ; le refactoring touche `watchlist.ts`, `profile.ts`, les pages profil et potentiellement les tests |
| Q2 — Non-déductible du code ? | OUI — la migration `001_init.sql` montre la RLS activée, mais la décision architecturale de "toujours vérifier l'identité via le client anon, puis bypasser la RLS avec le client admin dans les Server Actions" n'est pas déductible de `package.json` ni de `tsconfig.json` ; elle constitue un invariant de sécurité invisible dans les fichiers de configuration |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — listes-personnelles (toutes les Server Actions de `watchlist.ts`), profil (`ProfileClient` appelle `removeFromList` et `deleteList`), auth (le pattern `getAuthUser()` est couplé au client anon Supabase de `lib/supabase/server.ts`) |
| Q4 — Casse un invariant si ignoré ? | OUI — un dev qui remplace `createAdminClient()` par `createClient()` dans une Server Action voit ses opérations bloquées silencieusement par la RLS (pas d'erreur explicite, juste 0 ligne modifiée) ; un dev qui désactive `ENABLE ROW LEVEL SECURITY` expose les données de tous les utilisateurs à n'importe quelle requête anon |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

ZelianTV stocke les listes personnelles de chaque utilisateur dans la table `user_media_lists`. Sans contrôle d'accès, n'importe quelle requête (authentifiée ou non) pourrait lire ou modifier les listes d'un autre utilisateur. Le projet utilise Supabase, qui expose directement PostgreSQL via une API REST — le RLS est le mécanisme natif de Supabase pour l'isolation par tenant (ici, par utilisateur).

La particularité de l'implémentation est le double niveau de contrôle :
- **RLS au niveau BDD** (filet de sécurité) : même si une requête directe passe par l'API Supabase avec la clé anon, la politique `auth.uid() = user_id` bloque l'accès aux données d'un autre utilisateur.
- **Client admin (service_role) dans les Server Actions** (bypass contrôlé) : les Server Actions vérifient l'identité via `getAuthUser()` (client anon, lit le JWT du cookie), puis utilisent `createAdminClient()` (service_role) pour la mutation. Le bypass est délibéré : il permet de ne pas être contraint par les policies RLS tout en garantissant l'identité en amont.

## Décision identifiée

1. **Row Level Security activée** sur `user_media_lists` avec la politique : `auth.uid() = user_id` pour toutes les opérations (SELECT, INSERT, UPDATE, DELETE).
2. **Pattern systématique dans les Server Actions** : `getAuthUser()` (client anon, vérifie le JWT) → `createAdminClient()` (service_role, bypass RLS) → mutation. Ce pattern est appliqué dans `toggleWatchlist`, `removeFromList`, `deleteList`, `getWatchlistData`, `getUserLists`.
3. Le client service_role (`SUPABASE_SERVICE_ROLE_KEY`) n'est jamais exposé côté client : il est instancié uniquement dans les fichiers `'use server'` ou `lib/supabase/admin.ts`.

## Conséquences observées

### Positives

- Isolation complète des données entre utilisateurs au niveau BDD, indépendamment du code applicatif
- La clé service_role n'est jamais exposée au navigateur (stockée en variable d'environnement serveur uniquement)
- Le pattern `getAuthUser()` + admin est cohérent sur toutes les Server Actions du projet

### Négatives / Dette

- **`console.log` dans `createAdminClient()`** (`lib/supabase/admin.ts` lignes 7-10) : le JWT de la service_role est partiellement décodé et loggué en production. Violation de la règle absolue #4 des rules Zelian et potentielle fuite d'information sur le rôle du token. À supprimer immédiatement.
- **Opacité du pattern** : un dev qui ne connaît pas la convention project peut utiliser `createClient()` (anon) dans une Server Action et ne pas comprendre pourquoi ses opérations ne retournent aucune ligne — le RLS bloque silencieusement sans message d'erreur explicite.
- **Double instanciation de client** : chaque Server Action crée deux clients Supabase (anon + admin). Pas d'impact fonctionnel mais coût mémoire marginal.

## Recommandation

Garder — le modèle RLS + admin bypass est la pratique recommandée par Supabase pour les Server Actions. Action immédiate requise : supprimer les `console.log` dans `lib/supabase/admin.ts` (règle Zelian #4 violée). Envisager d'ajouter un commentaire explicitant le pattern dans les Server Actions pour les futurs devs.
