FROM node:20-slim

# Install PostgreSQL 17 client
RUN apt-get update && apt-get install -y curl gnupg2 lsb-release \
    && echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - \
    && apt-get update && apt-get install -y postgresql-client-17 \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Build client assets & server dist bundle inside container
RUN npm run build

# Set production environment
ENV NODE_ENV=production

# Expose port
EXPOSE 5000

# Start the application
CMD ["node", "dist/index.cjs"]
