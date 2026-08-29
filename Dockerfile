FROM node:22-alpine
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

HEALTHCHECK --interval=5s --timeout=3s --start-period=2s --retries=2 \
  CMD node -e "const req=require('http').get('http://127.0.0.1:3000/api/health',res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));" || exit 1

EXPOSE 3000
CMD ["node", "server.js"]
