FROM node:18.5.0-alpine3.15 as dependencies

WORKDIR /app
COPY src package.json package-lock.json ./
RUN npm ci --production
