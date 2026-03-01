FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build

RUN chmod +x /app/docker/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["npm", "run", "start:prod"]
