# CIRL 设计总纲

## 一、目标与范围

### 1.1 项目定位

**CIRL**（Core Iterative Knowledge Base with Feedback & Low Cost）是一个**应用优化平台**，围绕**应用（App）**进行问答跟踪、反馈闭环、数据集管理和效果评估，持续优化应用的表现。

### 1.2 核心价值

- **应用为中心**：以应用为优化单元，围绕其建立数据集
- **问答跟踪**：完整记录每次问答的 input/output，关联应用
- **反馈闭环**：收集用户反馈，形成优化建议，闭环处理
- **数据集命中分析**：监控问答记录与数据集的匹配情况（完全命中、80%相似、60%相似、未命中）
- **效果评估**：使用数据集评估优化前后的效果（准确性优先，速度次之）

### 1.3 边界与范围

**在范围内：**
- 问答记录存储与管理（input/output，关联应用）
- 反馈收集与处理流程（闭环系统）
- 数据集构建与管理（围绕应用）
- 数据集命中分析（相似度匹配）
- AI 分析优化建议生成
- 效果评估（准确性、速度）

**不在范围内：**
- 知识内容的直接编辑（由外部系统提供）
- 大模型的训练与微调
- 向量数据库的底层实现
- 用户权限与多租户管理（初期）

## 二、统一数据模型

### 2.1 核心实体

#### App（应用）
```typescript
interface App {
  id: string
  name: string
  description?: string
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}
```

#### QueryRecord（问答记录）
```typescript
interface QueryRecord {
  id: string
  appId: string // 关联的应用ID
  input: string // 用户输入的问题
  output: string // 应用输出的回答
  modelId?: string // 使用的模型标识（可选）
  context?: Record<string, any> // 上下文信息
  feedback?: Feedback // 用户反馈（可选）
  hitAnalysis?: HitAnalysis // 命中分析结果（可选）
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}
```

#### Feedback（反馈）
```typescript
interface Feedback {
  id: string
  queryRecordId: string
  type: 'positive' | 'negative' | 'neutral' | 'correction'
  content?: string // 反馈内容
  rating?: number // 评分 1-5
  correction?: string // 纠正后的答案（如果 type 是 correction）
  status: 'pending' | 'processed' | 'resolved'
  processedAt?: string
  resolution?: string // 处理方案
  optimizationSuggestion?: string // 优化建议
  createdAt: string
  updatedAt: string
}
```

#### Dataset（数据集）
```typescript
interface Dataset {
  id: string
  appId: string // 关联的应用ID
  name: string
  description?: string
  queryRecordIds: string[] // 包含的问答记录ID列表（作为标准答案集）
  metadata?: Record<string, any>
  createdAt: string
  updatedAt: string
}
```

#### HitAnalysis（命中分析）
```typescript
interface HitAnalysis {
  id: string
  queryRecordId: string
  datasetId: string
  matchType: 'exact' | 'high' | 'medium' | 'none' // 完全命中、80%相似、60%相似、未命中
  similarity: number // 相似度 0-100
  matchedQueryRecordId?: string // 匹配到的数据集中的问答记录ID
  analysisResult?: string // AI 分析结果
  createdAt: string
}
```

#### Evaluation（效果评估）
```typescript
interface Evaluation {
  id: string
  appId: string
  datasetId: string
  evaluationType: 'before' | 'after' // 优化前或优化后
  metrics: {
    accuracy: number // 准确率（优先级最高）
    speed: number // 速度（毫秒）
    exactHitRate: number // 完全命中率
    highHitRate: number // 80%相似命中率
    mediumHitRate: number // 60%相似命中率
    noHitRate: number // 未命中率
    avgRating: number // 平均评分
    feedbackCount: number // 反馈数量
  }
  queryRecordIds: string[] // 参与评估的问答记录
  evaluatedAt: string
  createdAt: string
  updatedAt: string
}
```

#### OptimizationSuggestion（优化建议）
```typescript
interface OptimizationSuggestion {
  id: string
  appId: string
  source: 'feedback' | 'hit-analysis' | 'evaluation' // 来源：反馈、命中分析、评估
  sourceId: string // 来源ID（feedbackId、hitAnalysisId、evaluationId）
  priority: 'high' | 'medium' | 'low'
  content: string // 优化建议内容
  status: 'pending' | 'applied' | 'rejected'
  appliedAt?: string
  result?: string // 应用结果
  createdAt: string
  updatedAt: string
}
```

### 2.2 数据关系

```
App (1) ──< (N) QueryRecord
QueryRecord (1) ──< (0..1) Feedback
QueryRecord (1) ──< (0..N) HitAnalysis
App (1) ──< (N) Dataset
Dataset (1) ──< (N) HitAnalysis
App (1) ──< (N) Evaluation
App (1) ──< (N) OptimizationSuggestion
```

### 2.3 核心流程

#### 问答跟踪流程
1. 应用接收用户输入（input）
2. 生成输出（output）
3. 记录问答对到 `QueryRecord`，关联 `appId`
4. 可选：进行命中分析，检查是否命中数据集

#### 反馈闭环流程
1. 用户对问答记录提交反馈
2. 反馈状态：pending → processed → resolved
3. AI 分析反馈，生成优化建议
4. 优化建议关联到应用
5. 跟踪优化效果（通过评估对比）

#### 数据集命中分析流程
1. 选择应用和数据集
2. 选择时间范围，筛选问答记录
3. 对每条问答记录进行相似度匹配：
   - 完全命中（100%相似）
   - 高相似度命中（80%相似）
   - 中等相似度命中（60%相似）
   - 未命中（<60%相似）
4. 生成命中分析报告
5. AI 分析命中情况，生成优化建议

#### 效果评估流程
1. 选择应用和数据集
2. 选择时间范围，筛选问答记录
3. 计算评估指标：
   - 准确性（基于反馈和命中分析）
   - 速度（平均响应时间）
   - 命中率分布
4. 对比优化前后的评估结果
5. 生成评估报告

## 三、技术选型

### 3.1 前端技术栈

- **框架**：Vue 3 + TypeScript + Vite 7.x
- **UI 组件库**：shadcn-vue（new-york 风格，Blue 主题）
- **样式**：Tailwind CSS v4
- **图标**：lucide-vue-next
- **路由**：vue-router
- **状态管理**：@vueuse/core（轻量级，按需引入）
- **数据可视化**：ECharts、vue-echarts、@unovis/vue（折线图、交互式十字准星、Tooltip、趋势图例等）

### 3.2 后端技术栈

- **框架**：Node.js + Express 4.x
- **数据存储**：SQLite 数据库（默认，`data/cirl.db`），支持 JSON Provider 作为备选
- **AI 集成**：预留接口，支持接入外部 AI 服务进行相似度计算和优化建议生成
- **数据库表结构**：
  - `apps` - 应用
  - `query_records` - 问答记录
  - `feedbacks` - 反馈
  - `datasets` - 数据集
  - `hit_analyses` - 命中分析
  - `evaluations` - 效果评估
  - `optimization_suggestions` - 优化建议

### 3.3 主题配置

- **基础色**：Blue
- **风格**：new-york
- **CSS 变量**：启用（cssVariables: true）

## 四、整体框架

### 4.1 系统架构

```
┌─────────────────────────────────────────┐
│          Frontend (Vue 3)                 │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │ 问答跟踪 │  │ 反馈管理 │  │ 评估   ││
│  └──────────┘  └──────────┘  └────────┘│
│  ┌──────────┐  ┌──────────┐             │
│  │ 命中分析 │  │ 优化建议 │             │
│  └──────────┘  └──────────┘             │
└─────────────────────────────────────────┘
              ↕ HTTP/REST
┌─────────────────────────────────────────┐
│      Backend (Express)                  │
│  ┌──────────┐  ┌──────────┐  ┌────────┐│
│  │ API 层   │  │ 业务逻辑 │  │ 数据层 ││
│  └──────────┘  └──────────┘  └────────┘│
│  ┌──────────┐                          │
│  │ AI 服务  │ (相似度计算、优化建议)    │
│  └──────────┘                          │
└─────────────────────────────────────────┘
              ↕
┌─────────────────────────────────────────┐
│      Data Layer (JSON Files)            │
│  applications.json, query-records.json,  │
│  feedbacks.json, datasets.json, etc.   │
└─────────────────────────────────────────┘
```

### 4.2 核心服务

#### AI 服务（预留接口）
- **相似度计算**：计算问答记录与数据集的相似度
- **优化建议生成**：基于反馈、命中分析、评估结果生成优化建议
- **文本分析**：分析问答内容，提取关键信息

## 五、UI 信息架构

### 5.1 导航结构

```
CIRL Console
├── 仪表盘 (Dashboard)
│   ├── 应用选择 / 时间范围切换
│   ├── 请求总览（24h / 7d / 30d）
│   └── 趋势图（折线图 + Tooltip + Crosshair）
├── 应用管理 (App Management)
│   ├── 应用列表
│   ├── 创建应用
│   └── 应用详情
├── 问答跟踪 (Query Tracking)
│   ├── 记录列表（按应用筛选）
│   ├── 详情查看
│   └── 时间范围筛选
├── 反馈管理 (Feedback Management)
│   ├── 待处理反馈
│   ├── 反馈历史
│   └── 优化建议
├── 数据集管理 (Dataset Management)
│   ├── 数据集列表（按应用筛选）
│   ├── 创建数据集
│   └── 数据集详情
├── 命中分析 (Hit Analysis)
│   ├── 分析任务
│   ├── 命中报告
│   └── 相似度分布
└── 效果评估 (Evaluation)
    ├── 评估任务
    ├── 评估报告
    └── 优化前后对比
```

### 5.2 页面布局

- **侧边栏**：shadcn-vue Sidebar（固定左侧）
- **主内容区**：Card + Tabs 布局
- **数据表格**：shadcn-vue Table 组件
- **表单**：Dialog + Form 组件
- **图表**：使用 shadcn-vue 组件 + 简单图表库

### 5.3 关键交互

- **仪表盘**：选择应用与时间范围，查看实时请求总数与趋势图，支持 Tooltip、图例开关与十字准星对齐
- **问答记录**：列表展示，支持按应用、时间范围筛选
- **应用选择**：所有页面支持按应用筛选
- **反馈提交**：在问答记录详情页直接提交反馈
- **数据集构建**：多选问答记录，批量创建数据集
- **命中分析**：选择应用、数据集、时间范围，一键生成分析报告
- **效果评估**：选择应用、数据集、时间范围，生成评估报告，支持优化前后对比

### 5.4 仪表盘页面说明

- **数据来源**：基于后端 `/api/stats/requests` 接口实时计算（不缓存）。
- **展示内容**：近 24 小时、7 天、30 天的请求总量、趋势折线、单点 Tooltip。
- **组件组合**：`ChartContainer` 提供主题上下文，内嵌 `ChartLegendContent`、`ChartTooltip( Content )`、`ChartCrosshair` 等复用组件。
- **导航入口**：Sidebar 顶部的 “Dashboard” 菜单，便于快速查看整体运行健康度。

## 六、数据策略

### 6.1 存储策略

- **单一事实源**：所有数据存储在 SQLite 数据库（`data/cirl.db`）中，支持 JSON Provider 作为备选
- **关联关系**：通过外键约束和 ID 引用，保证数据完整性
- **数据持久化**：数据库文件通过 Docker volume 挂载，确保数据持久化

### 6.2 查询策略

- **SQL 查询**：使用 SQLite 的索引优化查询性能
- **时间范围查询**：按 `created_at` 字段过滤，使用索引加速
- **应用筛选**：按 `app_id` 过滤，使用外键索引
- **性能优化**：大数据量时考虑分页、懒加载，利用 SQL 索引

### 6.3 数据一致性

- **事务支持**：SQLite 支持事务，确保关键操作的原子性
- **外键约束**：通过数据库外键保证关联数据的一致性
- **并发控制**：SQLite WAL 模式支持多读单写，提升并发性能

## 七、评估指标

### 7.1 准确性指标（优先级最高）

- **完全命中率**：完全匹配数据集的比例
- **高相似度命中率**：80%相似度匹配的比例
- **平均评分**：基于用户反馈的平均评分
- **正面反馈率**：正面反馈占总反馈的比例

### 7.2 速度指标

- **平均响应时间**：问答记录的平均处理时间（毫秒）
- **P95 响应时间**：95% 的请求响应时间

### 7.3 综合评分

```
综合评分 = (准确性权重 * 准确性得分) + (速度权重 * 速度得分)
其中：准确性权重 > 速度权重
```

## 八、里程碑建议

### Phase 1: 基础功能（MVP）
- [ ] 应用管理
- [ ] 问答记录存储与展示
- [ ] 反馈收集与处理
- [ ] 基础数据集管理

### Phase 2: 分析功能
- [ ] 命中分析（相似度匹配）
- [ ] AI 优化建议生成
- [ ] 效果评估（准确性、速度）

### Phase 3: 高级功能
- [ ] 优化前后对比
- [ ] 批量分析
- [ ] 数据导出/导入
- [ ] 性能优化

---

> **说明**：本文档为设计总纲，具体实现方案见 `docs/rfcs/` 目录下的 RFC 文档。
