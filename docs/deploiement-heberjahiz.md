# Deploiement sur un domaine Heberjahiz

Ce projet doit etre deploye sur un VPS ou un serveur Cloud/Dedie. Un hebergement mutualise classique n'est pas adapte, car l'application utilise Next.js, NestJS, PostgreSQL, Redis et MinIO.

## 1. Acheter/preparer le serveur

- Choisir un VPS Linux Ubuntu 22.04/24.04 ou Debian recent.
- Ouvrir les ports `80` et `443`.
- Installer Docker et Docker Compose.
- Recuperer l'adresse IP publique du serveur.

## 2. Configurer le domaine chez Heberjahiz

Dans la zone DNS Heberjahiz du domaine, creer un enregistrement :

- Type : `A`
- Nom : `pointage` ou `@` selon le domaine voulu
- Valeur : IP publique du VPS
- TTL : valeur par defaut

Exemples :

- `pointage.futura-expert.com` vers l'IP du VPS
- ou `futura-expert.com` vers l'IP du VPS

Attendre la propagation DNS avant de lancer HTTPS.

## 3. Copier le projet sur le serveur

```bash
git clone https://github.com/achrafelfadli22-bot/Application-pointage.git
cd Application-pointage
cp .env.production.example .env.production
```

Modifier `.env.production` :

- `APP_DOMAIN`
- `WEB_ORIGIN`
- `LETSENCRYPT_EMAIL`
- `POSTGRES_PASSWORD`
- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `MINIO_ACCESS_KEY`
- `MINIO_SECRET_KEY`
- `SMTP_*` si l'envoi email doit fonctionner

Generer les secrets avec :

```bash
openssl rand -base64 48
```

## 4. Lancer la production

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

Caddy va automatiquement demander un certificat HTTPS Let's Encrypt pour `APP_DOMAIN`.

## 5. Verifier

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f caddy
```

Puis ouvrir :

- `https://APP_DOMAIN`
- `https://APP_DOMAIN/api/health`

## 6. Mise a jour apres un push GitHub

```bash
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

## Notes importantes

- Ne jamais commiter `.env.production`.
- Garder une sauvegarde reguliere du volume PostgreSQL.
- MinIO n'est pas expose publiquement dans cette configuration.
- Swagger est desactive en production avec `SWAGGER_ENABLED=false`.
