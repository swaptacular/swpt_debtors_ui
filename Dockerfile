FROM node:14.17.6-buster AS build-image

WORKDIR /usr/src/app
COPY ./ ./
RUN npm install \
  && npm run build

# This is the final app image.
FROM nginx:1.21.1-alpine AS app-image

COPY --from=build-image /usr/src/app/public /usr/share/nginx/html
