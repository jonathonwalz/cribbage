FROM node:14-alpine AS base

RUN mkdir -p /opt/app
WORKDIR /opt/app
COPY package.json package-lock.json ./

# Build client
FROM base AS build

RUN npm ci --development && \
  mkdir /opt/app/build /opt/app/node_modules/.cache && \
  chown node /opt/app/build /opt/app/node_modules/.cache

COPY . /opt/app
USER node
ENV NODE_ENV=production
RUN npm run build

FROM base AS release

ENV NODE_ENV=production \
  PORT=3000
EXPOSE 3000

RUN npm ci --production && \
  npm cache clean --force

COPY . /opt/app
COPY --from=build /opt/app/build /opt/app/build

USER node

CMD ["node", "./src/server/index.js"]
