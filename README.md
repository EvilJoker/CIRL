# CIRL - 应用问答优化平台

**CIRL** = **C**ore **I**terative Knowledge Base with **F**eedback & **L**ow Cost

## 项目简介

CIRL 面向 AI 应用 / 知识库场景，围绕“应用（App）”构建问答监控与反馈闭环，帮助团队持续提升命中率和准确性。

## 核心能力

- **应用管理**：集中管理需要监控的 App/知识库
- **问答记录**：记录每次 input/output、模型信息、响应时间
- **反馈闭环**：收集反馈、AI 生成优化建议、标记处理状态
- **数据集管理**：将问答沉淀为标准数据集，支撑命中分析与评估
- **命中分析**：统计完全命中、80%/60% 相似命中、未命中
- **效果评估**：对比优化前后的准确性与速度，验证迭代成效

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite + Tailwind CSS v4 + shadcn-vue（Blue 主题）
- **后端**：Node.js + Express
- **数据存储**：本地 JSON 文件（apps / query-records / feedbacks / datasets / hit-analyses / evaluations / optimization-suggestions）

## 快速开始

### 一键启动（推荐）

```bash
# 启动项目（自动安装依赖并启动前后端）
./start.sh

# 停止项目
./stop.sh
```

### 手动启动

#### 安装依赖

```bash
# 根目录
npm install

# 前端
cd web
npm install
```

#### 开发

```bash
# 启动前端开发服务器
npm run dev

# 启动后端服务器（新终端）
npm run dev:server
```

### 构建

```bash
npm run build
```

## 项目结构

```
cirl/
├── bin/              # CLI 工具
├── server/           # Express 后端服务
├── web/              # Vue 3 前端项目
├── data/             # 数据文件（JSON）
├── docs/             # 文档
└── dist/             # 构建输出
```

## 文档

- `docs/PROJECT_OVERVIEW.md` - 当前方案/验收/清单（单一事实源）
- `docs/rfcs/` - 方案层 RFC
- `docs/tech/` - 实现层技术文档（含 API 参考）
- `docs/schemas/` - 数据 Schema

## API 文档

启动服务后，访问 **http://localhost:3001/api-docs** 查看交互式 API 文档（Swagger UI），支持在线测试所有接口。

## License

MIT

