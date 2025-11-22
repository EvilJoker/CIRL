#!/bin/bash

# CIRL 停止脚本
# 停止容器和本地服务

echo "🛑 停止 CIRL 项目..."

# 停止 Docker 容器
if command -v docker &> /dev/null; then
    if docker ps -a --format '{{.Names}}' | grep -q '^cirl$'; then
        echo "🐳 停止 Docker 容器..."
        cd docker && (docker-compose down 2>/dev/null || docker compose down 2>/dev/null) && cd ..
        echo "✅ Docker 容器已停止"
    fi
fi

# 停止本地后端服务器
if [ -f ".server.pid" ]; then
    SERVER_PID=$(cat .server.pid)
    if ps -p $SERVER_PID > /dev/null 2>&1; then
        echo "🔧 停止本地后端服务器 (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null
        echo "✅ 后端服务器已停止"
    fi
    rm -f .server.pid
fi

# 尝试停止可能残留的进程
if command -v lsof &> /dev/null; then
    EXISTING=$(lsof -ti:10001 2>/dev/null)
    if [ -n "$EXISTING" ]; then
        echo "⚠️  发现端口 10001 仍有进程占用，尝试清理..."
        kill $EXISTING 2>/dev/null
        sleep 1
    fi
fi

echo "✅ 所有服务已停止"
