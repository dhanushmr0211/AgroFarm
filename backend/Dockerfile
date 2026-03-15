FROM node:20-alpine

WORKDIR /app

# Copy package files AND prisma schema (needed for postinstall → prisma generate)
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for prisma CLI)
# postinstall script will run prisma generate automatically
RUN npm ci

# Copy the rest of the application source
COPY . .

# Remove devDependencies to keep image lean
RUN npm prune --production

ENV NODE_ENV=production
ENV PORT=10000

EXPOSE 10000

CMD ["node","src/server.js"]
