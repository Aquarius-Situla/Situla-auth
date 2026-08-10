FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --production

COPY . .

# Ensure data directory exists and set ownership to the built-in node user (UID 1000)
RUN mkdir -p /app/data && \
    chown -R node:node /app

# 确保 host 上 ./data 目录权限与容器用户匹配 (UID 1000)
USER node

EXPOSE 3000
CMD ["node", "server.js"]
