Recrea todas las imágenes definidas en docker-compose.dev.yml

docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml exec api node dist/db/seeds/171004_seed_inicial.js
   

solo api
docker compose -f docker-compose.dev.yml build api
docker compose -f docker-compose.dev.yml up -d api


Limpiar y iniciar

docker compose -f docker-compose.dev.yml build --no-cache api
docker compose -f docker-compose.dev.yml up -d api

