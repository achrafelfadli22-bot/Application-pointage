# Remise à zéro de l'environnement de test

Cette procédure supprime tous les comptes et toutes les données opérationnelles. Elle conserve les entreprises, les types de congé et les migrations Prisma. Elle vide également les catalogues de types de tâches, postes d'entreprise, postes sur site et clients.

## 1. Démarrer PostgreSQL

```powershell
docker compose up -d postgres
```

## 2. Exécuter la remise à zéro

```powershell
$env:CONFIRM_RESET_ALL_DATA="YES"
$env:RESET_TENANT_SLUG="futura-expertise"
$env:RESET_HR_EMAIL="rh@futura-expert.com"
$env:RESET_HR_PASSWORD="123456789"
pnpm db:reset-test
Remove-Item Env:CONFIRM_RESET_ALL_DATA
Remove-Item Env:RESET_TENANT_SLUG
Remove-Item Env:RESET_HR_EMAIL
Remove-Item Env:RESET_HR_PASSWORD
```

Compte recréé : `rh@futura-expert.com` avec le mot de passe indiqué dans `RESET_HR_PASSWORD`.

## 3. Configurer l'application avec le RH

1. Ouvrir **Paramètres > Types timesheet** et saisir les types de tâches.
2. Ouvrir **Paramètres > Sites** et saisir les postes d'entreprise et les postes sur site.
3. Ouvrir **Mon équipe > Nouvel employé**.
4. Choisir **Ressource Manager** dans **Statut d'entreprise** pour créer le premier Resource Manager.

Ne lancez pas `pnpm db:seed` après cette remise à zéro : l'ancien script de démonstration recrée des comptes prédéfinis.
