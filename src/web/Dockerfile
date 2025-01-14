# Build stage
FROM node:18-alpine AS builder
# version: 18-alpine

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies with cache mounting for faster builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

# Copy application source and config files
COPY tsconfig.json tsconfig.node.json vite.config.ts ./
COPY src/ ./src/
COPY public/ ./public/

# Set build arguments
ARG VITE_API_URL
ARG VITE_APP_VERSION
ARG VITE_COMMIT_HASH
ARG NODE_ENV=production

# Build application
RUN npm run build

# Production stage
FROM nginx:1.25-alpine
# version: 1.25-alpine

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache curl tzdata

# Create nginx user/group with restricted permissions
RUN addgroup -g 101 -S nginx && \
    adduser -S -D -H -u 101 -h /var/cache/nginx -s /sbin/nologin -G nginx -g nginx nginx

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY infrastructure/kubernetes/web/nginx-config.yaml /etc/nginx/nginx.conf
COPY infrastructure/kubernetes/web/security-headers.yaml /etc/nginx/conf.d/security-headers.conf

# Set proper permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

# Configure nginx
ENV NGINX_WORKER_PROCESSES auto
ENV NGINX_WORKER_CONNECTIONS 1024

# Security headers
RUN echo "add_header Content-Security-Policy \"default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.myelixir.com wss://*.myelixir.com;\";" > /etc/nginx/conf.d/security-headers.conf && \
    echo "add_header Strict-Transport-Security \"max-age=31536000; includeSubDomains\" always;" >> /etc/nginx/conf.d/security-headers.conf && \
    echo "add_header X-Frame-Options \"DENY\" always;" >> /etc/nginx/conf.d/security-headers.conf && \
    echo "add_header X-Content-Type-Options \"nosniff\" always;" >> /etc/nginx/conf.d/security-headers.conf && \
    echo "add_header X-XSS-Protection \"1; mode=block\" always;" >> /etc/nginx/conf.d/security-headers.conf && \
    echo "add_header Referrer-Policy \"strict-origin-when-cross-origin\" always;" >> /etc/nginx/conf.d/security-headers.conf

# Enable compression
RUN echo "gzip on;" >> /etc/nginx/conf.d/gzip.conf && \
    echo "gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;" >> /etc/nginx/conf.d/gzip.conf

# Configure SSL/TLS
RUN echo "ssl_protocols TLSv1.2 TLSv1.3;" >> /etc/nginx/conf.d/ssl.conf && \
    echo "ssl_prefer_server_ciphers on;" >> /etc/nginx/conf.d/ssl.conf && \
    echo "ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;" >> /etc/nginx/conf.d/ssl.conf

# Health check configuration
RUN echo "location /health { \n access_log off; \n return 200 'healthy\n'; \n add_header Content-Type text/plain; \n }" > /etc/nginx/conf.d/health.conf

# Expose port
EXPOSE 80

# Switch to non-root user
USER nginx

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]