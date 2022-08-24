ARG NODE_VER

FROM node:${NODE_VER} as builder
MAINTAINER pedro

ADD example /opt/app_src/example
ADD packages /opt/app_src/packages
ADD scripts /opt/app_src/scripts
COPY .eslintignore /opt/app_src/
COPY .eslintrc /opt/app_src/
COPY lerna.json /opt/app_src/
COPY package.json /opt/app_src/
COPY package-lock.json /opt/app_src/
COPY tsconfig.json /opt/app_src/

WORKDIR /opt/app_src
RUN npm install \
    && npm run bootstrap:monorepo \
    && npm run bootstrap:example \
    && npm run check:skip-test

FROM node:${NODE_VER}-alpine as runtime

RUN apk add --no-cache bash

COPY --from=builder /opt/app_src/dist /opt/app/dist
COPY --from=builder /opt/app_src/example /opt/app/example

USER root
WORKDIR /opt/app/example
ENTRYPOINT [ "npm" ]
CMD ["run", "start"]
