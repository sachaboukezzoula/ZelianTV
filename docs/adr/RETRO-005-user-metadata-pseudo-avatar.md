# RETRO-005 — Stockage du pseudo et de l'avatar en user_metadata Supabase Auth

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-06-24          |
| Source     | Rétro-ingénierie    |
| Features   | profil-utilisateur, upload-avatar |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — migrer vers une table `user_profiles` toucherait `app/profil/page.tsx` (lecture du pseudo et de l'avatar_url), `app/profil/ProfileClient.tsx` (affichage et formulaire de modification du pseudo), `app/actions/profile.ts` (écriture de l'email, revoir le contexte de mise à jour), `app/actions/avatar.ts` (l'URL de l'avatar est actuellement écrite dans `user_metadata` via `supabase.auth.updateUser`). Il faudrait également créer une migration Supabase pour la nouvelle table et gérer la coexistence des données historiques stockées en metadata. |
| Q2 — Non-déductible du code ? | OUI — `package.json` et `tsconfig.json` ne révèlent pas ce choix. Le SDK Supabase permet indifféremment de stocker les données de profil en `user_metadata` (JSON Supabase Auth) ou dans une table BDD dédiée. La décision de privilégier `user_metadata` pour le pseudo (`display_name`) et l'avatar (`avatar_url`) — plutôt qu'une table `user_profiles` avec FK sur `auth.users` — est une intention architecturale invisible dans les fichiers de configuration. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — profil-utilisateur (lecture de `user.user_metadata.display_name` et `avatar_url` dans `ProfileClient.tsx`, écriture via `supabase.auth.updateUser` pour le pseudo et dans `uploadAvatarAction` pour l'avatar) et upload-avatar (l'URL publique avec cache-busting est stockée en `user_metadata`, pas en BDD). Ces deux features partagent la même contrainte de stockage. |
| Q4 — Casse un invariant si ignoré ? | OUI — un dev qui crée une table `user_profiles` pour y stocker le pseudo sans migrer l'existant crée une divergence silencieuse : les utilisateurs existants ont leur pseudo en `user_metadata.display_name`, les nouveaux en BDD, et la page profil affiche `user.user_metadata?.display_name ?? 'Mon profil'` — les nouveaux utilisateurs voient systématiquement 'Mon profil' alors que leur pseudo est en BDD. Même risque pour `avatar_url`. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

ZelianTV utilise Supabase comme backend unique. Supabase Auth expose nativement un champ `user_metadata` (JSON libre) sur chaque utilisateur, accessible et modifiable via `supabase.auth.updateUser({ data: { ... } })` sans nécessiter de table BDD supplémentaire ni de migration. Pour une v1 avec des données de profil simples (un pseudo textuel, une URL d'avatar), le stockage en `user_metadata` réduit la surface de code : pas de table à maintenir, pas de FK à déclarer, pas de RLS à configurer.

## Décision identifiée

Les deux champs de profil non-auth sont stockés dans `user_metadata` du compte Supabase Auth, pas dans une table BDD dédiée :

- **`display_name`** : pseudo de l'utilisateur, modifiable via `supabase.auth.updateUser({ data: { display_name: value } })` côté client dans `handleSubmit()` de `ProfileClient.tsx` (mode `'pseudo'`).
- **`avatar_url`** : URL publique de l'avatar avec paramètre de cache-busting (`?t=<timestamp>`), écrite via `supabase.auth.updateUser({ data: { avatar_url: url } })` dans `uploadAvatarAction` (`app/actions/avatar.ts`).

Lecture dans `ProfileClient.tsx` :
```ts
const avatarUrl = user.user_metadata?.avatar_url as string | undefined
const displayName = user.user_metadata?.display_name as string | undefined
```

L'objet `user` est passé depuis le Server Component `app/profil/page.tsx` qui le récupère via `supabase.auth.getUser()`.

## Conséquences observées

### Positives

- Pas de table `user_profiles` à créer, ni de migration, ni de politique RLS supplémentaire
- Le pseudo et l'avatar sont accessibles directement depuis l'objet `User` Supabase partout dans l'application — pas de jointure ni de requête supplémentaire
- Modification du pseudo côté client sans passer par une Server Action (l'appel `supabase.auth.updateUser` est direct depuis le composant)

### Négatives / Dette

- **Typage faible** : `user_metadata` est typé `Record<string, unknown>` — le code caste explicitement en `string | undefined` sans vérification de forme. L'absence d'un type `UserProfile` partagé signifie que toute erreur de clé (`avatar_Url` au lieu de `avatar_url`) est silencieuse.
- **Pas de validation côté serveur pour le pseudo** : la modification du pseudo passe par le client Supabase navigateur directement (`supabase.auth.updateUser`) sans Server Action intermédiaire. Il n'y a pas de validation de longueur ni de contenu du côté serveur.
- **Migration future contraignante** : si les besoins de profil évoluent (ajout de bio, liens sociaux, préférences d'affichage), `user_metadata` JSON n'est pas structuré pour les requêtes et tris BDD. Une migration vers une table dédiée sera nécessaire et impliquera un backfill des données existantes.
- **Cache-busting en metadata** : stocker `avatar_url?t=<timestamp>` en metadata signifie que chaque upload d'avatar génère une nouvelle valeur en metadata, mais l'URL de base dans Supabase Storage reste `<user_id>.jpg` — la liste d'URLs historiques n'est pas conservée.

## Recommandation

Garder pour la v1 — la simplicité est justifiée pour un profil aussi basique. Planifier pour une v2 :
1. Ajouter un type `UserProfile` partagé qui mappe les champs de `user_metadata` attendus
2. Encapsuler la mise à jour du pseudo dans une Server Action pour ajouter une validation serveur (longueur max, caractères autorisés)
3. Si des champs de profil supplémentaires sont ajoutés, créer une table `user_profiles` avec migration backfill des `display_name` et `avatar_url` existants
