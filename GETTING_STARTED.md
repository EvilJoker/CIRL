# 快速开始指南

## 安装

### 1. 安装根目录依赖

```bash
npm install
```

### 2. 安装前端依赖

```bash
cd web
npm install
cd ..
```

## 启动开发环境

### 方式一：一键启动（最简单，推荐）

```bash
./start.sh
```

脚本会自动：
- 检查并安装依赖
- 启动后端服务器（端口 3001）
- 启动前端开发服务器（端口 5173）

按 `Ctrl+C` 停止服务

### 方式二：分别启动

**终端 1 - 启动后端服务器**:
```bash
npm run dev:server
```

后端将在 `http://localhost:3001` 运行

**终端 2 - 启动前端开发服务器**:
```bash
npm run dev
```

前端将在 `http://localhost:5173` 运行

### 停止服务

如果使用一键启动脚本，按 `Ctrl+C` 即可。

或者使用停止脚本：
```bash
./stop.sh
```

## 访问应用

打开浏览器访问：`http://localhost:5173`

## 功能使用

### 1. 查看统计信息

首页显示：
- 知识总数
- 核心知识数量
- 反馈总数
- 待处理问题数

### 2. 管理知识

- 点击"添加知识"按钮创建新知识
- 使用筛选器按类别、层级筛选
- 点击"编辑"或"删除"管理知识项

### 3. 查询知识

- 在右侧查询面板输入问题
- 点击"查询"按钮
- 查看匹配的知识项
- 提交反馈（1-5星）

### 4. 查看问题

- 右侧显示待处理问题列表
- 未匹配的查询会自动记录为问题

## API 使用

### 第三方应用对接

后端 API 运行在 `http://localhost:3001/api`

**查询示例**:
```bash
curl -X POST http://localhost:3001/api/query \
  -H "Content-Type: application/json" \
  -d '{"query": "如何设计系统架构？"}'
```

详细 API 文档请查看：`docs/tech/api-reference.md`

## 数据文件

数据存储在 `data/` 目录：

- `index.json` - 知识索引
- `knowledge.json` - 知识集
- `feedbacks.json` - 反馈
- `issues.json` - 问题

## 构建生产版本

```bash
npm run build
```

构建产物在 `dist/` 目录。

## 常见问题

### 端口被占用

修改端口：
- 后端：修改 `server/index.js` 中的 `PORT` 变量
- 前端：修改 `web/vite.config.ts` 中的 `server.port`

### 数据文件不存在

系统会自动创建默认数据文件，如果遇到问题，可以手动创建：

```bash
# 确保 data 目录存在
mkdir -p data

# 创建空文件（系统会自动初始化）
touch data/index.json data/knowledge.json data/feedbacks.json data/issues.json
```

## 下一步

- 阅读 `docs/design.md` 了解系统设计
- 查看 `docs/tech/快速开发指南.md` 了解开发细节
- 查看 `docs/tech/api-reference.md` 了解 API 接口

