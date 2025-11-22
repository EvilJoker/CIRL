# 多阶段构建：构建阶段
FROM node:20-alpine AS builder

ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_PROXY=
ARG NPM_HTTPS_PROXY=
# 设置 npm 配置
ENV npm_config_registry=${NPM_REGISTRY} \
    npm_config_progress=true

WORKDIR /app

# 复制根目录 package 文件
COPY package*.json ./

# 安装根目录依赖（使用 shell 来条件设置代理）
RUN if [ -n "$NPM_PROXY" ]; then \
        export npm_config_proxy="$NPM_PROXY" && \
        export npm_config_https_proxy="$NPM_HTTPS_PROXY" && \
        export HTTP_PROXY="$NPM_PROXY" && \
        export HTTPS_PROXY="$NPM_HTTPS_PROXY" && \
        export http_proxy="$NPM_PROXY" && \
        export https_proxy="$NPM_HTTPS_PROXY" && \
        npm ci --loglevel=verbose; \
    else \
        npm ci --loglevel=verbose; \
    fi

# 复制前端 package 文件
COPY web/package*.json ./web/

# 安装前端依赖（包括 devDependencies，构建需要）
RUN if [ -n "$NPM_PROXY" ]; then \
        export npm_config_proxy="$NPM_PROXY" && \
        export npm_config_https_proxy="$NPM_HTTPS_PROXY" && \
        export HTTP_PROXY="$NPM_PROXY" && \
        export HTTPS_PROXY="$NPM_HTTPS_PROXY" && \
        export http_proxy="$NPM_PROXY" && \
        export https_proxy="$NPM_HTTPS_PROXY" && \
        cd web && npm ci --loglevel=verbose && npm list vue-tsc && ls -la node_modules/.bin/vue-tsc && cd ..; \
    else \
        cd web && npm ci --loglevel=verbose && npm list vue-tsc && ls -la node_modules/.bin/vue-tsc && cd ..; \
    fi

# 复制所有源代码
COPY . .

# 构建前端
RUN npm run build

# 运行阶段
FROM node:20-alpine

ARG NPM_REGISTRY=https://registry.npmmirror.com
ARG NPM_PROXY=
ARG NPM_HTTPS_PROXY=
# 设置 npm 配置
ENV npm_config_registry=${NPM_REGISTRY} \
    npm_config_progress=true

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 只安装生产依赖（使用 shell 来条件设置代理）
RUN if [ -n "$NPM_PROXY" ]; then \
        export npm_config_proxy="$NPM_PROXY" && \
        export npm_config_https_proxy="$NPM_HTTPS_PROXY" && \
        export HTTP_PROXY="$NPM_PROXY" && \
        export HTTPS_PROXY="$NPM_HTTPS_PROXY" && \
        export http_proxy="$NPM_PROXY" && \
        export https_proxy="$NPM_HTTPS_PROXY" && \
        npm ci --only=production --loglevel=verbose; \
    else \
        npm ci --only=production --loglevel=verbose; \
    fi

# 从构建阶段复制构建产物和必要文件
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/bin ./bin

# 确保数据目录存在且可写
RUN mkdir -p /app/data && chmod 755 /app/data

# 暴露端口
EXPOSE 10001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:10001/api/apps', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动服务
CMD ["node", "server/index.js"]
