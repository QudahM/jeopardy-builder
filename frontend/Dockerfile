FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html
# Setup Nginx to handle SPA routing by fallback to index.html and reverse proxy /api to backend
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    client_max_body_size 500M; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
        add_header Cache-Control "no-cache, no-store, must-revalidate"; \
    } \
    location /api/ { \
        proxy_pass http://backend:8080; \
    } \
    location /uploads/ { \
        proxy_pass http://backend:8080; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
