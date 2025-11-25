# CIRL - 应用问答优化平台

**CIRL** = **C**ore **I**terative Knowledge Base with **F**eedback & **L**ow Cost

## 项目简介

CIRL 面向 AI 应用场景，围绕"应用（App）"构建问答监控与反馈闭环，帮助团队持续提升命中率和准确性。

## 核心能力

- **应用管理**：集中管理需要监控的应用（App）
- **问答记录**：记录每次 input/output、模型信息、响应时间
- **反馈闭环**：收集反馈、AI 生成优化建议、标记处理状态
- **数据集管理**：将问答沉淀为标准数据集，支撑命中分析与评估
- **命中分析**：统计完全命中、80%/60% 相似命中、未命中
- **效果评估**：对比优化前后的准确性与速度，验证迭代成效

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite + Tailwind CSS v4 + shadcn-vue（Blue 主题）
- **后端**：Node.js + Express
- **数据存储**：SQLite 数据库（支持 JSON Provider 作为备选）
- **API 文档**：Swagger UI / OpenAPI 3.0

## 快速开始

### 容器化部署（推荐）

```bash
# 启动项目（自动构建并启动容器）
./start.sh

# 停止项目
./stop.sh
```

访问地址：**http://localhost:10001**

### 本地开发

```bash
# 本地启动（适合开发调试）
./start.sh --local
```

更多部署说明请参考：[快速开发指南](快速开发指南.md)

## 文档导航

- 📖 [项目总览](docs/PROJECT_OVERVIEW.md) - 当前方案/验收/清单（单一事实源）
- 🚀 [快速开发指南](快速开发指南.md) - 开发、调试和部署指南
- 📋 [RFC 方案](docs/rfcs/) - 方案层设计文档
- 🔧 [API 参考](docs/tech/api-reference.md) - API 接口文档
- 📐 [设计总纲](docs/design.md) - 整体架构设计

## API 文档

启动服务后，访问 **http://localhost:10001/api-docs** 查看交互式 API 文档（Swagger UI），支持在线测试所有接口。

## 项目结构

```
cirl/
├── bin/              # CLI 工具
├── server/           # Express 后端服务
│   ├── providers/   # 数据存储 Provider（SQLite/JSON）
│   └── ...
├── web/              # Vue 3 前端项目
├── data/             # 数据目录（SQLite 数据库文件）
├── docs/             # 文档
├── docker/           # Docker 相关文件
├── start.sh          # 启动脚本
└── stop.sh           # 停止脚本
```

## License

MIT
