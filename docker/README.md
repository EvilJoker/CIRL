# Docker 部署配置

本目录包含 CIRL 项目的 Docker 容器化部署相关文件。

## 文件说明

- `Dockerfile` - Docker 镜像构建文件（多阶段构建）
- `docker-compose.yml` - Docker Compose 配置文件
- `.dockerignore` - Docker 构建忽略文件

## 使用方法

### 通过根目录脚本（推荐）

```bash
# 在项目根目录执行
./start.sh        # 启动容器
./stop.sh         # 停止容器
```

### 直接使用 Docker Compose

```bash
# 进入 docker 目录
cd docker

# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 停止
docker-compose down
```

## 配置说明

- **构建上下文**：指向项目根目录（`..`）
- **数据持久化**：`../data` 目录挂载到容器内的 `/app/data`
- **端口映射**：`10001:10001`
- **健康检查**：自动检查 `/api/apps` 接口
- **数据存储**：默认使用 SQLite（`data/cirl.db`），可通过 `DATA_PROVIDER` 环境变量切换为 JSON

## 注意事项

1. 确保项目根目录存在 `data/` 目录
2. 首次构建可能需要较长时间（下载依赖和构建前端）
3. 数据库文件存储在项目根目录的 `data/cirl.db`，首次启动会自动创建
4. 使用 `sql.js`（纯 JavaScript），无需编译工具，构建速度更快

## 网络/镜像配置

容器构建时可以通过环境变量配置 npm 镜像源和代理：

1. 在 `docker/.env` 中配置：
   ```bash
   cat > docker/.env <<'EOF'
   NPM_REGISTRY=https://registry.npmmirror.com
   NPM_PROXY=http://your-proxy:port
   NPM_HTTPS_PROXY=http://your-proxy:port
   EOF
   ```

2. 或在执行 `./start.sh` 前导出环境变量：
   ```bash
   export NPM_REGISTRY=https://registry.npmmirror.com
   export NPM_PROXY=http://your-proxy:port
   export NPM_HTTPS_PROXY=http://your-proxy:port
   ```

**说明**：
- `NPM_REGISTRY`：npm 镜像源（默认：`https://registry.npmmirror.com`）
- `NPM_PROXY` / `NPM_HTTPS_PROXY`：代理地址（可选，如果网络环境需要）

