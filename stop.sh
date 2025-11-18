#!/bin/bash

# CIRL 停止脚本

echo "🛑 停止 CIRL 项目..."

# 停止后端服务器
if [ -f ".server.pid" ]; then
    SERVER_PID=$(cat .server.pid)
    if ps -p $SERVER_PID > /dev/null 2>&1; then
        kill $SERVER_PID 2>/dev/null
        echo "✅ 后端服务器已停止 (PID: $SERVER_PID)"
    fi
    rm -f .server.pid
fi


echo "✅ 所有服务已停止"

