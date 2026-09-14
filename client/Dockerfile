FROM node:22-alpine AS build

WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:3000
ARG VITE_WS_BASE_URL=ws://localhost:3000
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_WS_BASE_URL=${VITE_WS_BASE_URL}

COPY client/package*.json ./
RUN npm ci
COPY client ./
COPY shared /shared
RUN npm run build

FROM nginx:1.27-alpine
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
