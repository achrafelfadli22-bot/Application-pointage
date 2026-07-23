docker compose --progress=plain `
  --env-file .env.production `
  -p pointage360-prod-local `
  -f docker-compose.prod.yml `
  -f docker-compose.prod.local.yml `
  build web

docker compose `
  --env-file .env.production `
  -p pointage360-prod-local `
  -f docker-compose.prod.yml `
  -f docker-compose.prod.local.yml `
  build api


docker compose `
  --env-file .env.production `
  -p pointage360-prod-local `
  -f docker-compose.prod.yml `
  -f docker-compose.prod.local.yml `
  up -d postgres redis minio minio-init api web