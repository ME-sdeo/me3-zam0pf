# ---- Builder Stage ----
FROM node:18-alpine AS builder
LABEL stage=builder

# Set working directory with proper permissions
WORKDIR /usr/src/app

# Set environment for build
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=4096"

# Install build essentials
RUN apk add --no-cache python3 make g++ \
    && mkdir -p /usr/src/app \
    && chown -R node:node /usr/src/app

# Copy package files with proper permissions
COPY --chown=node:node package*.json ./

# Install dependencies
RUN npm ci --include=dev

# Copy source code
COPY --chown=node:node . .

# Build TypeScript code
RUN npm run build \
    && npm prune --production \
    && apk del python3 make g++

# ---- Production Stage ----
FROM node:18-alpine AS production
LABEL maintainer="MyElixir Team" \
      description="HIPAA-compliant MyElixir backend service" \
      version="1.0.0"

# Set production environment
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=2048"

# Create non-root user/group
RUN addgroup -g 1000 nodegroup \
    && adduser -u 1000 -G nodegroup -s /bin/sh -D nodeuser \
    && mkdir -p /usr/src/app \
    && chown -R nodeuser:nodegroup /usr/src/app

# Set working directory
WORKDIR /usr/src/app

# Copy built artifacts from builder
COPY --from=builder --chown=nodeuser:nodegroup /usr/src/app/dist ./dist
COPY --from=builder --chown=nodeuser:nodegroup /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=nodeuser:nodegroup /usr/src/app/package*.json ./

# Set secure permissions
RUN chmod 755 /usr/src/app \
    && chmod 644 /usr/src/app/package*.json \
    && chmod -R 755 /usr/src/app/dist \
    && chmod -R 755 /usr/src/app/node_modules

# Security configurations
RUN apk add --no-cache curl \
    && echo "fs.file-max = 65535" >> /etc/sysctl.conf \
    && echo "kernel.unprivileged_userns_clone = 1" >> /etc/sysctl.conf

# Healthcheck configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose application port
EXPOSE 3000

# Switch to non-root user
USER nodeuser

# Start production server
CMD ["node", "dist/server.js"]

# ---- Development Stage ----
FROM node:18-alpine AS development
LABEL stage=development

# Set development environment
ENV NODE_ENV=development \
    NODE_OPTIONS="--max-old-space-size=4096"

# Set working directory
WORKDIR /usr/src/app

# Install development dependencies
COPY package*.json ./
RUN npm install

# Copy source code and configuration
COPY . .

# Expose ports (app + debug)
EXPOSE 3000 9229

# Start development server with hot reload
CMD ["npm", "run", "dev"]