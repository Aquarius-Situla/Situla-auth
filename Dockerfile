FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --production

COPY . .

# Create data directory and a non-root user for security
RUN mkdir -p /app/data && \
    addgroup -S appgroup && \
    adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000
CMD ["node", "server.js"]
