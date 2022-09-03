FROM node:16.17 AS base

FROM base AS build

WORKDIR /build

COPY .yarn .yarn
COPY [ "yarn.lock", ".yarnrc.yml", "package.json", "/build/"]
COPY majsoul/package.json ./majsoul/
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN yarn --immutable

COPY ./ /build/

WORKDIR /build/majsoul
RUN yarn run proto:admin:generate
RUN yarn run proto:fetch
RUN yarn run proto:generate
RUN yarn run proto:copy
RUN yarn run tsc --build --verbose

WORKDIR /build/backend
RUN yarn run tsc --build --verbose

FROM build AS backend
FROM build

WORKDIR /build/frontend
RUN yarn run webpack --mode=production

FROM nginx AS frontend
COPY --from=build /build/frontend/dist /dist
COPY ./nginx.conf /etc/nginx/nginx.conf
