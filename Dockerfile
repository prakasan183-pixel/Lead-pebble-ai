FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY server.ts ./
COPY firebase-applet-config.json ./
COPY src ./src
COPY dist ./dist

EXPOSE 8080
CMD ["npm", "start"]
