# NEXUS Legacy — interface monochrome

Site statique compatible Vercel, avec recherche, comptes Supabase, crédits quotidiens et modération vidéo.

## Version 47

- Palette noir, blanc et gris sur toutes les pages, logos monochromes, cartes et navigation affinées.
- Animations d’entrée, apparition des résultats et balayage lumineux de l’aperçu ; préférence de réduction des mouvements respectée.
- Inscription par pseudo + e-mail, puis vérification par code ; connexion par e-mail + code sans mot de passe.
- Renvoi du code après 60 secondes, modification de l’adresse et messages pour les codes invalides ou expirés.
- Cinq crédits quotidiens à minuit, heure de Paris, avec prise en compte des changements d’heure. Le solde est remis à cinq, sans cumul. Les administrateurs restent illimités.
- Le renouvellement est calculé côté serveur lors de la consultation du solde ou du débit. Un verrou empêche deux recherches simultanées de dépenser le même crédit. Aucun cron n’est nécessaire ; les comptes inactifs sont remis à jour à leur prochaine utilisation.
- L’annonce de suppression apparaît uniquement si `nexus_site_settings.accounts_reset_at` a été renseigné après une réinitialisation réussie. Elle est mémorisée par navigateur pour cette version de la réinitialisation. Le dialogue natif gère le focus, Échap et la navigation clavier.

## Configuration publique

`js/config.js` contient l’URL Supabase, la clé publique publishable et la liste ordonnée `endpoints` des sources de recherche. Ajoute ou retire les URL dans ce tableau ; le site essaie chaque source dans l’ordre jusqu’à obtenir une réponse HTTP valide. Aucune clé secrète ou service role ne doit figurer dans le site.

Chaque source doit autoriser le domaine du site via CORS. Le moteur utilise directement les endpoints configurés. Aucun proxy n’est fourni. Une réponse valide, même vide, coûte un crédit ; les sources en erreur sont ignorées au profit de la suivante et l’échec de toutes les sources ne déclenche aucun débit. Une erreur d’enregistrement de l’historique ne masque pas les résultats déjà payés.

Le client Supabase chargé par CDN est fixé à `2.119.0`.

## Installation de la base

Sur une installation neuve, exécuter dans cet ordre :

1. `supabase_schema.sql`
2. `supabase_search_fix.sql`
3. `supabase_admin_media_fix.sql`
4. `supabase_credit_auth_fix.sql`

Sur le projet existant disposant déjà des tables et fonctions admin, appliquer seulement `supabase_credit_auth_fix.sql`, après inspection du schéma et sauvegarde. Ce script ne supprime aucun compte. Ne pas réappliquer ensuite les anciens scripts de recherche : ils remplaceraient la fonction de débit quotidien.

Le statut administrateur vient de `nexus_profiles.is_admin`, colonne non modifiable par les utilisateurs. Les métadonnées utilisateur servent uniquement au pseudo. Si un pseudo existe déjà, le serveur ajoute un suffixe pour permettre la création du profil.

## Activer les codes e-mail dans Supabase

Dans **Authentication → Sign In / Providers → Email** :

- Activer Email et les inscriptions.
- Conserver la vérification des adresses.
- Régler l’expiration des codes à **600 secondes** et leur longueur à **6 chiffres**. Le formulaire accepte également les projets configurés pour huit chiffres.

Dans **Authentication → Email Templates**, installer le contenu de `email-templates/otp.html` pour **Magic Link / OTP** et **Confirm signup**, avec l’objet « Ton code de connexion NEXUS ». La variable `{{ .Token }}` affiche le code. Le parcours utilise `signInWithOtp` et `verifyOtp` avec le type `email`.

Configurer un SMTP de production dans Supabase et tester avec une adresse réelle autorisée : le service intégré Supabase limite l’envoi aux adresses de l’équipe et ne convient pas aux inscriptions publiques. Ne pas désactiver la vérification e-mail pour contourner un problème d’envoi.

Documentation : [connexion par code](https://supabase.com/docs/guides/auth/auth-email-passwordless), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Réinitialisation exceptionnelle des membres

`supabase_reset_members_once.sql` est une opération destructive séparée de l’installation normale. Il faut d’abord exporter une sauvegarde privée, inspecter les comptes administrateurs et traiter les éventuels fichiers possédés par les membres via l’API Storage. Ne jamais publier cette sauvegarde dans GitHub.

Le script conserve les profils `is_admin`, les comptes administrateurs identifiés par les métadonnées applicatives protégées et les superadministrateurs. Il refuse de supprimer les comptes si aucun administrateur n’est identifié. Il supprime les sessions et comptes Auth des autres membres ; les tables liées par `ON DELETE CASCADE`, dont leur historique et leurs vidéos, sont également concernées. Les fichiers Storage nécessitent un traitement distinct.

La suppression des comptes et l’activation de l’annonce sont dans la même transaction. En cas d’erreur, tout est annulé. Ne jamais relancer ce script après la réouverture des inscriptions : cela supprimerait aussi les nouveaux comptes.

Un JWT déjà émis reste signé jusqu’à expiration, mais les fonctions de crédits et les privilèges admin exigent un profil encore présent.

## Administration et vidéos

La console permet de choisir un utilisateur, fixer ses crédits, consulter ses recherches et critères, ouvrir/fermer le site et modérer les vidéos BAVUR / BLOCUS. Les vidéos approuvées apparaissent sur l’accueil. Le nombre de crédits défini manuellement s’applique jusqu’au prochain renouvellement quotidien.

## Vérification locale

```sh
python3 -m http.server 8000
```

Ouvrir `http://localhost:8000/`. Aucun build n’est nécessaire. Les huit routes partagent le même balisage et les fichiers `js/app.js`, `js/interface.js`, `css/style.css` et `css/interface.css`.

Tests hors ligne sur macOS, sans envoi d’e-mails ni recherche réelle :

```sh
python3 tests/verify_search.py
python3 tests/verify_auth.py
```

Ces tests vérifient les interactions de recherche, l’absence de débit en cas d’erreur de source, les états de session, les formulaires, les codes e-mail et l’adaptation des soldes. Les réglages SMTP, la suppression des vrais comptes et les règles du projet doivent aussi être vérifiés sur Supabase avant mise en ligne.

Test d’intégration facultatif dans une base locale jetable (dépendances `pgserver` et `psycopg2-binary`) : `python3 tests/verify_database.py`. Ce test couvre aussi les débits concurrents, les permissions, les changements d’heure et la conservation des administrateurs pendant la réinitialisation.

## V48 — modération des comptes et activité

Appliquer `supabase_account_moderation.sql` **après** `supabase_credit_auth_fix.sql`. Ne pas réappliquer les anciens scripts après cette migration : ils remplaceraient les contrôles d’accès plus récents.

Dans Administration → Utilisateurs, **Gérer l’accès** propose :

- une suspension de 1 heure, 24 heures, 7 jours ou 30 jours, avec motif obligatoire ;
- un bannissement permanent, jusqu’à réactivation par un administrateur ;
- la réactivation du compte, qui exige une nouvelle connexion.

Les administrateurs sont protégés contre ces sanctions. Les opérations sont contrôlées côté serveur, enregistrées dans un journal privé et atomiques avec la révocation des sessions et la mise à jour du bannissement Supabase Auth. Les crédits, la recherche, les données du compte et les écritures vidéo restent bloqués même avec un ancien JWT signé. Se déconnecter ou changer de navigateur ne lève pas la sanction. Une suspension expire automatiquement ; les comptes restent soumis aux règles normales de connexion.

**Voir l’activité** charge les recherches enregistrées, les vidéos et les sanctions via une fonction réservée aux administrateurs. Les entrées sont datées, triées et affichées comme du texte ; les états de chargement, de liste vide et d’erreur sont pris en charge. Les anciennes recherches déjà supprimées par la politique historique de conservation ne sont pas recréées.

Vérifications supplémentaires : `python3 tests/verify_moderation.py` (PostgreSQL jetable) et `python3 tests/verify_admin_browser.py` (Playwright, avec `python3 -m http.server 8000` lancé à la racine). Ces tests ne sanctionnent aucun vrai membre.
