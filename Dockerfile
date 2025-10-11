# Multi-stage Dockerfile for Kamer.ba
# This builds both frontend and backend in one container

# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Customer Portal
FROM node:18-alpine AS portal-builder

WORKDIR /app/customer-portal
COPY customer-portal/package*.json ./
RUN npm ci
COPY customer-portal/ ./
RUN npm run build

# Stage 3: Backend Production
FROM node:18-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create app directory
WORKDIR /app

# Copy backend files
COPY backend/package*.json ./
RUN npm ci --production && npm cache clean --force

# Copy backend source
COPY backend/ ./

# Copy built frontends
COPY --from=frontend-builder /app/frontend/dist ./public/frontend
COPY --from=portal-builder /app/customer-portal/dist ./public/customer-portal

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads

# Set proper permissions
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "index.js"]

