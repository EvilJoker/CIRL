# CIRL 项目总览

## 1. 项目简介

- **名称**：CIRL（Core Iterative Knowledge Base with Feedback & Low Cost）
- **定位**：面向 AI 应用的问答监控与优化平台
- **目标**：以应用（App）为粒度，跟踪问答、收集反馈、评估命中率与准确性，形成低成本闭环迭代
- **技术栈**：
  - 前端：Vue 3 + TypeScript + Vite + Tailwind CSS v4 + shadcn-vue（Blue 主题）
  - 后端：Node.js + Express
  - 存储：本地 JSON 文件（单一事实源，易于调试和部署）

## 2. 核心能力

| 能力 | 说明 |
| --- | --- |
| 应用管理 | 统一管理待监控的应用（App），支撑后续问答与数据集 |
| 问答跟踪 | 记录每一次问答 input/output、模型信息、时间区间 |
| 反馈闭环 | 收集/处理反馈，AI 分析后生成优化建议，形成闭环 |
| 数据集管理 | 将问答记录沉淀为数据集，作为命中与评估的基准 |
| 命中分析 | 统计完全命中/80%/60%/未命中，辅助运维定位问题 |
| 效果评估 | 按数据集对比优化前后准确性与响应速度，验证优化结果 |

## 3. 架构概览

```
┌────────────────┐     ┌────────────────────┐
│  shadcn-vue UI │ <-> │  Express REST APIs  │
└────────────────┘     └────────────────────┘
           ↑                         ↑
┌────────────────────┐     ┌────────────────────┐
│ Vue Router + Pages │     │ JSON Data Layer     │
│ (App / Query / ...)│     │ apps / queries ...  │
└────────────────────┘     └────────────────────┘
           ↑
┌────────────────────┐
│ AI Placeholder svc │  (相似度计算 / 评估指标)
└────────────────────┘
```

前端提供八个主要页面（应用管理、QA 跟踪、QA 管理、反馈管理、QA 数据集、Tag 管理、命中分析、效果评估），通过 Sidebar 导航。后端暴露 REST API，负责存储、命中计算与评估计算。

## 4. 数据模型（当前方案）

```ts
// 应用（App）
interface App {
  id: string
  name: string
  description?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}

// 问答记录
interface QueryRecord {
  id: string
  appId: string
  input: string
  output: string
  modelId?: string
  context?: Record<string, any>
  metadata?: Record<string, any> // 例如响应时间
  createdAt: string
  updatedAt: string
}

// 反馈
interface Feedback {
  id: string
  queryRecordId: string
  type: 'positive' | 'negative' | 'neutral' | 'correction'
  content?: string
  rating?: number
  correction?: string
  status: 'pending' | 'processed' | 'resolved'
  optimizationSuggestion?: string
  createdAt: string
  updatedAt: string
}

// 数据集（标准问答集合）
interface Dataset {
  id: string
  appId: string
  name: string
  description?: string
  queryRecordIds: string[]
  createdAt: string
  updatedAt: string
}

// 命中分析
interface HitAnalysis {
  id: string
  queryRecordId: string
  datasetId: string
  matchType: 'exact' | 'high' | 'medium' | 'none'
  similarity: number
  matchedQueryRecordId?: string
  createdAt: string
}

// 效果评估
interface Evaluation {
  id: string
  appId: string
  datasetId: string
  evaluationType: 'before' | 'after'
  metrics: {
    accuracy: number
    speed: number
    exactHitRate: number
    highHitRate: number
    mediumHitRate: number
    noHitRate: number
    avgRating: number
    feedbackCount: number
  }
  queryRecordIds: string[]
  evaluatedAt: string
  createdAt: string
  updatedAt: string
}

// 优化建议
interface OptimizationSuggestion {
  id: string
  appId: string
  source: 'feedback' | 'hit-analysis' | 'evaluation'
  sourceId: string
  priority: 'high' | 'medium' | 'low'
  content: string
  status: 'pending' | 'applied' | 'rejected'
  appliedAt?: string
  createdAt: string
  updatedAt: string
}
```

## 5. API 速览

| 模块 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| Apps | GET/POST/PUT/DELETE | `/api/apps` | 管理应用 |
| Query Records | GET/POST/PUT | `/api/query-records` | 问答记录（按 app/time 筛选） |
| Feedbacks | GET/POST/PUT | `/api/feedbacks` | 反馈收集、处理与优化建议 |
| Datasets | GET/POST/PUT/DELETE | `/api/datasets` | 数据集管理 |
| Hit Analysis | GET/POST | `/api/hit-analyses` | 命中分析任务与统计 |
| Evaluations | GET/POST | `/api/evaluations` | 效果评估与前后对比 |
| Suggestions | GET/PUT | `/api/optimization-suggestions` | 优化建议跟踪 |

**API 文档**：
- 交互式文档（推荐）：http://localhost:3001/api-docs（Swagger UI）
- 文本文档：`docs/tech/api-reference.md`

## 6. 前端布局

- **Sidebar 导航**：应用管理 / QA 跟踪 / QA 管理 / 反馈管理 / QA 数据集 / Tag 管理 / 命中分析 / 效果评估
- **应用管理**：列表 + Dialog 创建/编辑
- **QA 跟踪**：按应用 + 时间范围筛选、列表展示、录入记录、提交反馈
- **QA 管理**：问答记录的集中管理和标记
- **反馈管理**：按状态筛选、处理反馈、生成优化建议
- **QA 数据集**：选择问答记录创建数据集
- **Tag 管理**：标签的统一管理
- **命中分析**：选择应用 + 数据集 + 时间区间，统计命中分布
- **效果评估**：选择数据集，计算准确性/速度指标，对比优化前后

## 7. 数据文件

| 文件 | 说明 |
| --- | --- |
| `apps.json` | App 定义 |
| `query-records.json` | 问答记录 |
| `feedbacks.json` | 反馈记录 |
| `datasets.json` | 数据集 |
| `hit-analyses.json` | 命中分析结果 |
| `evaluations.json` | 评估结果 |
| `optimization-suggestions.json` | 优化建议 |

## 8. 快速上手

```bash
# 安装依赖
npm install
cd web && npm install && cd ..

# 一键启动
./start.sh
```

浏览器访问 `http://localhost:5173`，进入对应导航即可操作。

## 9. 功能清单（精简版）

- [x] 应用管理（App）
- [x] 问答记录跟踪与反馈提交
- [x] 数据集创建与维护
- [x] 命中分析（完全 / 80% / 60% / 未命中）
- [x] 效果评估（准确性 + 速度）
- [x] 优化建议生成与跟踪
- [ ] AI 相似度/建议服务（占位中，可替换为真实服务）

## 10. 下一步建议

| 方向 | 建议 |
| --- | --- |
| AI 集成 | 接入真实相似度/评估服务（RAG、LLM） |
| 自动化 | 支持定时评估与命中分析任务 |
| 数据治理 | 支持数据导入导出、权限与审计 |
| 可视化 | 增强命中/评估的可视化图表、趋势分析 |

---

> **提示**：本文件为项目总览，合并了验收清单和关键结论，保持单一事实源。具体方案请参考 `docs/design.md` 与 `docs/rfcs/`。

