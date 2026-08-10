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

# 确保 host 上 ./data 目录权限与容器用户匹配 (UID 1000)
USER appuser

EXPOSE 3000
CMD ["node", "server.js"]
