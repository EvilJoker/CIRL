#!/bin/bash

# CIRL 一键启动脚本

echo "🚀 启动 CIRL 项目..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js >= 20.0.0"
    exit 1
fi

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装根目录依赖..."
    npm install || exit 1
fi

if [ ! -d "web/node_modules" ]; then
    echo "📦 安装前端依赖..."
    cd web && npm install && cd .. || exit 1
fi

# 清理旧的 PID 文件
rm -f .server.pid

# 确保 3001 端口空闲
if command -v lsof &> /dev/null; then
    EXISTING=$(lsof -ti:3001 2>/dev/null)
    if [ -n "$EXISTING" ]; then
        echo "⚠️  端口 3001 被进程占用 (PID: $EXISTING)，尝试自动释放..."
        kill $EXISTING 2>/dev/null
        sleep 1
        if lsof -ti:3001 >/dev/null 2>&1; then
            echo "❌ 无法释放端口 3001，请手动关闭相关进程后重试。"
            exit 1
        fi
        echo "✅ 端口 3001 已释放。"
    fi
else
    echo "ℹ️ 未检测到 lsof，无法自动检查端口占用，请确保 3001 端口空闲。"
fi

# 启动后端服务器（后台运行）
echo "🔧 启动后端服务器 (端口 3001)..."
node server/index.js > server.log 2>&1 &
SERVER_PID=$!

# 保存 PID 到文件，方便停止
echo $SERVER_PID > .server.pid

# 等待后端启动
sleep 2

# 检查后端是否启动成功
if ! ps -p $SERVER_PID > /dev/null 2>&1; then
    echo "❌ 后端服务器启动失败，请查看 server.log"
    rm -f .server.pid
    exit 1
fi

# 检查端口是否可访问（如果 curl 可用）
if command -v curl &> /dev/null; then
    if curl -s http://localhost:3001/api/stats > /dev/null 2>&1; then
        echo "✅ 后端服务器已启动 (PID: $SERVER_PID)"
    else
        echo "⚠️  后端服务器可能未完全启动，请稍候..."
    fi
else
    echo "✅ 后端服务器进程已启动 (PID: $SERVER_PID)"
fi

# 启动前端开发服务器
echo "🎨 启动前端开发服务器 (端口 5173)..."
echo ""
echo "=========================================="
echo "  CIRL 项目已启动"
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:3001"
echo "=========================================="
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 清理函数：当脚本退出时停止后端
cleanup() {
    echo ""
    echo "🛑 停止后端服务器..."
    if [ -f ".server.pid" ]; then
        PID=$(cat .server.pid)
        kill $PID 2>/dev/null
        rm -f .server.pid
    fi
    exit
}

# 注册清理函数
trap cleanup INT TERM

# 启动前端（前台运行，可以看到日志）
cd web && npm run dev

# 如果前端退出，也清理后端
cleanup

