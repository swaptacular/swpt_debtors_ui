FROM node:18.20.4-alpine3.19 AS build-image

WORKDIR /usr/src/app
COPY ./ ./
RUN npm install \
  && npm run build

# This is the final app image.
FROM nginx:1.27.0-alpine3.19 AS app-image

ENV NGINX_ENVSUBST_TEMPLATE_DIR=/usr/share/nginx/html
ENV NGINX_ENVSUBST_OUTPUT_DIR=/usr/share/nginx/html

ENV SERVER_API_TIMEOUT=8000
ENV TRANSFER_DELETION_DELAY_SECONDS=1296000
ENV DEFAULT_PEG_ABBR=
ENV DEFAULT_PEG_COIN=

COPY --from=build-image /usr/src/app/public /usr/share/nginx/html
COPY nginx-add-headers.conf /etc/nginx/conf.d/nginx-add-headers.conf
