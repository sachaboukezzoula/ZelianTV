# RETRO-006 — Fichier avatar nommé par user_id avec upsert (un fichier par utilisateur)

| Champ      | Valeur              |
|------------|---------------------|
| Statut     | Documenté (rétro)   |
| Date       | 2026-06-24          |
| Source     | Rétro-ingénierie    |
| Features   | upload-avatar, profil-utilisateur |

## Justification (politique ADR v2.3.0)

| Champ | Valeur |
|-------|--------|
| Catégorie | DATA-MODEL |
| Q1 — Coût de revert > 1j ? | OUI — changer le format de clé (ex. `<user_id>/<timestamp>.jpg` pour conserver un historique) nécessiterait de migrer les URLs stockées dans `user_metadata.avatar_url` pour tous les utilisateurs existants (les anciennes URLs pointent vers `<user_id>.jpg` sans sous-dossier), d'adapter `uploadAvatarAction` pour produire les nouvelles clés, et de décider d'une stratégie de nettoyage des fichiers orphelins en Storage. Refactoring transverse sur la Server Action, les metadata Auth, et potentiellement un script de migration. |
| Q2 — Non-déductible du code ? | OUI — `package.json` et `tsconfig.json` ne révèlent pas ce choix. Le SDK Supabase Storage permet indifféremment `upload` (erreur si le fichier existe) ou `upsert: true`, et accepte n'importe quel format de clé. La décision de nommer le fichier `<user_id>.jpg` (clé fixe, un seul fichier par utilisateur, pas d'historique) est une intention architecturale invisible dans les fichiers de configuration. |
| Q3 — Impact transverse (≥ 2 specs) ? | OUI — upload-avatar (écrit `<user_id>.jpg` avec upsert) et profil-utilisateur (lit `user_metadata.avatar_url` pour afficher l'image via `<Image src={avatarUrl}>` dans `ProfileClient.tsx`). Un changement de format de clé en Storage invalide les URLs stockées dans tous les profils existants et casse l'affichage côté profil. |
| Q4 — Casse un invariant si ignoré ? | OUI — un dev qui modifie le nom du fichier en Storage (ex. ajout d'un suffixe de version ou d'un timestamp dans la clé) sans migrer les URLs en `user_metadata` rend silencieusement tous les avatars existants inaccessibles : l'URL en metadata pointe vers `<user_id>.jpg`, le nouveau fichier s'appelle `<user_id>-v2.jpg`, le `<Image>` renvoie une 404. Aucune erreur applicative n'est levée — les utilisateurs voient le fallback initiale sans comprendre pourquoi. |

> Validé contre la politique `.claude/rules/06-adr-policy.md`.

## Contexte

ZelianTV utilise Supabase Storage comme système de fichiers pour les avatars. L'objectif fonctionnel est simple : un utilisateur a exactement un avatar à tout moment, remplacé par le dernier upload. La décision de nommer le fichier par `user_id` fixe une clé de stockage déterministe qui permet l'upsert sans gestion d'index ni de liste de fichiers.

## Décision identifiée

Dans `uploadAvatarAction` (`app/actions/avatar.ts`, ligne 22-26) :

```ts
const fileName = `${user.id}.jpg`

const { error: uploadError } = await admin.storage
  .from('avatars')
  .upload(fileName, buffer, { upsert: true, contentType: 'image/jpeg' })
```

Le fichier est nommé `<user_id>.jpg` dans le bucket `avatars`. Le paramètre `{ upsert: true }` remplace silencieusement le fichier existant si l'utilisateur a déjà un avatar. Il n'y a pas d'historique des avatars précédents dans Storage.

L'URL publique résultante suit le pattern :
```
https://<project>.supabase.co/storage/v1/object/public/avatars/<user_id>.jpg?t=<timestamp>
```

Le paramètre `?t=<timestamp>` est ajouté à cette URL avant stockage en `user_metadata.avatar_url` pour le cache-busting (voir section Conséquences).

## Conséquences observées

### Positives

- Clé déterministe : aucune requête de liste des fichiers nécessaire pour retrouver l'avatar d'un utilisateur donné. La clé est calculable de n'importe où à partir du `user_id`.
- Gestion de l'espace de stockage implicite : chaque utilisateur occupe au maximum un fichier — pas d'accumulation d'avatars obsolètes à purger.
- Simplicité de l'implémentation : `upsert: true` rend l'opération idempotente. Aucune logique de suppression préalable nécessaire.

### Negatives / Dette

- **Absence d'historique** : il est impossible de revenir à un avatar précédent ou d'auditer les changements d'avatar. Le fichier précédent est écrasé définitivement.
- **Extension hardcodée `.jpg`** : le fichier est toujours nommé `<user_id>.jpg`, quel que soit le format original (PNG, WebP, etc.). La compression Canvas convertit toujours en JPEG, donc le `.jpg` est techniquement correct, mais ce choix est implicite dans le code et non documenté.
- **Couplage URL metadata / clé Storage** : l'URL stockée en `user_metadata.avatar_url` est directement dérivée de la clé Storage (avec `?t=<timestamp>` en plus). Toute modification de la structure de clé invalide les URLs déjà stockées.
- **Cache-busting par paramètre URL** : l'URL de base identique entre deux uploads force l'usage d'un paramètre `?t=<timestamp>` pour invalider le cache navigateur. Ce workaround est un indice que la stratégie de clé fixe crée une friction avec les comportements CDN standard. Documenté en `spec-technique.md` section Patterns.

## Recommandation

Garder pour la v1 — la simplicité est justifiée pour un profil avec un avatar unique. Si les besoins évoluent (historique d'avatars, modération, audit), prévoir :
1. Une migration du format de clé vers `avatars/<user_id>/<timestamp>.jpg`
2. Un script de backfill des `user_metadata.avatar_url` pour les utilisateurs existants
3. Une politique de rétention (ou de suppression des anciens fichiers) dans Supabase Storage
