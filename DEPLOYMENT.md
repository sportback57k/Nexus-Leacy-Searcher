# Mise à jour NEXUS V47

La version 47 apporte une interface cyber noir et blanc, des animations respectant la réduction des mouvements, une connexion par code e-mail et une annonce de réinitialisation des comptes.

## Supabase

- Le correctif `supabase_credit_auth_fix.sql` est appliqué au projet existant.
- Les membres reçoivent cinq crédits par jour à minuit, heure de Paris, sans cumul. Le renouvellement et le débit sont atomiques ; les administrateurs conservent leurs crédits illimités.
- Le SMTP Gmail est configuré dans Supabase. Ses identifiants restent exclusivement dans la configuration privée du service.
- L’inscription exige un code e-mail de six chiffres, valable dix minutes. Les modèles de confirmation et de connexion utilisent `email-templates/otp.html`.
- Un envoi réel et une connexion par code ont été vérifiés depuis le site ; le compte de test a reçu cinq crédits.
- La réinitialisation exceptionnelle a été exécutée le 2026-11-17T12:35:46.617865+00:00. Les deux comptes administrateurs existants ont été conservés. Une vérification immédiatement après l’opération a confirmé deux comptes Auth et deux profils, tous administrateurs.
- Une sauvegarde privée locale des comptes, profils, historiques, fonctions et du fichier vidéo membre concerné est conservée hors du dépôt.

## Vérifications

Les tests de recherche, de code e-mail et d’intégration PostgreSQL sont passés. Ils couvrent les erreurs, les débits concurrents, le changement d’heure, les permissions, les attributions de crédits par les administrateurs et la protection des comptes administrateurs. Un test transactionnel sur le projet réel a également vérifié le renouvellement et le débit, puis annulé les données de test. Le rendu des sept routes a été vérifié sur ordinateur et mobile.

## À conserver

L’annonce s’affiche grâce à `nexus_site_settings.accounts_reset_at` et sa fermeture est mémorisée par navigateur. Les nouvelles inscriptions restent ouvertes.

Ne pas relancer `supabase_reset_members_once.sql` : c’est une opération exceptionnelle qui supprimerait les nouveaux membres. Le script refuse une seconde exécution après la date de réinitialisation enregistrée.

## V48 — sanctions et activité administrateur

`supabase_account_moderation.sql` est appliqué. Les sanctions modifient le bannissement Supabase Auth et révoquent les sessions dans la même transaction. Les opérations du compte vérifient aussi la session réelle, le statut de suspension et les règles RLS. Les administrateurs sont protégés.

Les tests sur un compte temporaire du projet ont confirmé le blocage du mot de passe, de la validation OTP, du renouvellement de session et des crédits avec un ancien JWT. La réactivation autorise une nouvelle connexion et conserve le solde. Le compte de test et ses données ont été supprimés ; aucun membre réel n’a été sanctionné.

L’interface propose les suspensions de 1 heure, 24 heures, 7 jours et 30 jours, le bannissement permanent et la réactivation. « Voir l’activité » utilise une fonction réservée aux administrateurs et affiche les recherches conservées, les vidéos et l’historique des sanctions. Tests PostgreSQL et navigateur réussis, y compris les états vides, les erreurs, le texte non interprété et le rendu mobile.
