FROM node:20-alpine AS builder

ARG VITE_TEST_MODE=false
ENV VITE_TEST_MODE=$VITE_TEST_MODE

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
