FROM node:20-alpine AS builder

ARG VITE_TEST_MODE=false
ARG VITE_TELEGRAM_SDK_APPNAME
ARG VITE_TELEGRAM_SDK_KEY
ENV VITE_TEST_MODE=$VITE_TEST_MODE
ENV VITE_TELEGRAM_SDK_APPNAME=$VITE_TELEGRAM_SDK_APPNAME
ENV VITE_TELEGRAM_SDK_KEY=$VITE_TELEGRAM_SDK_KEY

WORKDIR /app
COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

# Serve static files with nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
