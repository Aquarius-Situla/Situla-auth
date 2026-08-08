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

# 注释掉 USER appuser，因为在 Alpine 环境下，非 root 用户通过
# Bind Mount 访问启用 WAL 模式的 SQLite 数据库时会抛出 SQLITE_READONLY 错误
# USER appuser

EXPOSE 3000
CMD ["node", "server.js"]
