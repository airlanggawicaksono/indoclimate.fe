# Use Node.js Alpine
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy application code
COPY . .

# Build Next.js
RUN npm run build

# Remove devDependencies
RUN npm prune --production

# Start Next.js (shell form for env var expansion)
CMD npm start
