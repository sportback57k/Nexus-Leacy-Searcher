# État de la mise à jour NEXUS V47

La refonte noir et blanc, les animations, les formulaires de code e-mail et l’annonce de réinitialisation sont prêts et testés.

Sur le projet Supabase existant, `supabase_credit_auth_fix.sql` est appliqué : renouvellement des crédits à minuit Europe/Paris, débit atomique, création sécurisée des profils, permissions des fonctions et attribution des crédits par les administrateurs. Le test transactionnel sur le projet a vérifié le renouvellement et le débit, puis annulé les données de test. Les codes sont réglés à six chiffres et dix minutes ; l’URL du site est corrigée.

Une sauvegarde privée locale des comptes, profils, historiques, vidéos et fonctions a été vérifiée avant toute suppression. Elle ne figure pas dans ce dépôt.

**En attente : un SMTP personnalisé.** Le projet n’en possède aucun. Supabase refuse actuellement la modification des modèles e-mail sur ce projet gratuit utilisant son fournisseur par défaut. Le service d’envoi disponible séparément ne dispose pas non plus d’un domaine validé adapté à Nexus.

L’ancien site et ses comptes restent disponibles pendant ce blocage. Pour terminer :

1. Configurer un SMTP et un expéditeur autorisé dans Supabase.
2. Appliquer `email-templates/otp.html` à la confirmation d’inscription et au Magic Link / OTP, puis activer la vérification des adresses (`mailer_autoconfirm=false`).
3. Vérifier un envoi et une connexion réels par code.
4. Archiver les fichiers des membres concernés, puis exécuter une seule fois `supabase_reset_members_once.sql`, en conservant les administrateurs identifiés.
5. Publier cette branche sur `main`. L’annonce s’activera grâce à la date de réinitialisation enregistrée par le script.

Les tests locaux couvrent les formulaires, les codes invalides, le renvoi, les sessions, les soldes, les débits concurrents, le passage heure d’été/hiver, la protection des administrateurs et l’annulation de la suppression sans administrateur. Le rendu des sept routes a été vérifié sur ordinateur et mobile avec le service d’authentification simulé.
