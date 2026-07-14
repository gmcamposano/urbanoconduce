# Stage 1: Build the application
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# line to test
RUN npx svelte-kit sync
RUN npm run build

RUN npm prune --production

# Stage 2: Run the application
FROM node:22-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY --from=builder /app/build build/
COPY --from=builder /app/node_modules node_modules/
COPY package.json .

ENV PORT 3000
EXPOSE 3000

CMD ["node", "build/index.js"]