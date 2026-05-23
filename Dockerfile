FROM node:22-alpine

# Install build deps for better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Create persistent dirs (mount volumes here on Railway/Render)
RUN mkdir -p /app/data /app/uploads

EXPOSE 3000

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV UPLOADS_DIR=/app/uploads

CMD ["node", "server.js"]
