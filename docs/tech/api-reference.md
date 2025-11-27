# API 参考文档

## 快速访问

**交互式 API 文档（推荐）**：访问 [http://localhost:10001/api-docs](http://localhost:10001/api-docs) 查看 Swagger UI 交互式文档，支持在线测试接口。

## 基础信息

- Base URL: `http://localhost:10001/api`
- Content-Type: `application/json`
- API 文档: `http://localhost:10001/api-docs` (Swagger UI)

---

## 1. 应用（App）管理

### 获取应用列表
`GET /api/apps`

### 获取单个应用
`GET /api/apps/:id`

### 创建应用
`POST /api/apps`
```json
{
  "name": "ChatBot A",
  "description": "客服问答应用"
}
```

### 更新应用
`PUT /api/apps/:id`

### 删除应用
`DELETE /api/apps/:id`

---

## 2. 问答记录（QueryRecord）

### 查询问答记录
`GET /api/query-records`

可选查询参数：
- `appId`
- `startDate` / `endDate`（ISO 日期字符串）
- `page` / `pageSize`

### 获取单条记录
`GET /api/query-records/:id`

### 创建记录
`POST /api/query-records`
```json
{
  "appId": "app_123",
  "input": "用户问题",
  "output": "模型回答",
  "modelId": "gpt-4",
  "context": {},
  "metadata": { "responseTime": 850 }
}
```

### 更新记录
`PUT /api/query-records/:id`

---

## 3. 反馈（Feedback）

### 查询反馈
`GET /api/feedbacks`

查询参数：
- `status`：pending / processed / resolved
- `appId`
- `queryRecordId`

### 创建反馈
`POST /api/feedbacks`
```json
{
  "queryRecordId": "qr_123",
  "type": "negative",
  "content": "答案不够具体",
  "rating": 2
}
```

### 更新反馈
`PUT /api/feedbacks/:id`

### AI 分析反馈 / 生成优化建议
`POST /api/feedbacks/:id/analyze`

---

## 4. 数据集（Dataset）

### 查询数据集
`GET /api/datasets?appId=app_123`

### 获取单个数据集
`GET /api/datasets/:id`

### 创建数据集
`POST /api/datasets`
```json
{
  "appId": "app_123",
  "name": "常见问题-2025Q1",
  "description": "一季度常见问题",
  "queryRecordIds": ["qr_1", "qr_2"]
}
```

### 更新 / 删除数据集
`PUT /api/datasets/:id`
`DELETE /api/datasets/:id`

---

## 5. 命中分析（Hit Analysis）

命中分析现在直接对“QA 跟踪”（实时问答）与“QA 管理”（精选问题）进行比对，不再需要手动选择数据集。

### 触发分析
`POST /api/hit-analyses`
```json
{
  "appId": "app_123",
  "range": "24h", // 支持 24h / 7d / 30d
  "modelId": "model_001"
}
```

### 获取分析结果
`GET /api/hit-analyses?appId=app_123&range=24h`

### 获取命中统计
`GET /api/hit-analyses/stats?appId=app_123&range=24h`

返回示例：
```json
{
  "exact": 12,
  "high": 30,
  "medium": 18,
  "none": 5,
  "total": 65
}
```

---

## 6. 效果评估（Evaluation）

### 创建评估
`POST /api/evaluations`
```json
{
  "appId": "app_123",
  "datasetId": "ds_1",
  "evaluationType": "before",
  "startDate": "2025-01-01",
  "endDate": "2025-01-31"
}
```

### 查询评估结果
`GET /api/evaluations?appId=app_123&datasetId=ds_1`

### 对比优化前后
`GET /api/evaluations/compare?appId=app_123&datasetId=ds_1`

返回示例：
```json
{
  "before": {
    "metrics": {
      "accuracy": 82.5,
      "speed": 950,
      "exactHitRate": 35,
      "highHitRate": 40,
      "mediumHitRate": 15,
      "noHitRate": 10,
      "avgRating": 3.2,
      "feedbackCount": 25
    }
  },
  "after": {
    "metrics": {
      "accuracy": 91.2,
      "speed": 780,
      "exactHitRate": 45,
      "highHitRate": 38,
      "mediumHitRate": 12,
      "noHitRate": 5,
      "avgRating": 4.1,
      "feedbackCount": 18
    }
  }
}
```

---

## 7. 统计（Stats）

### 获取请求统计
`GET /api/stats/requests?appIds=app_1,app_2`

- `appIds`：可选，逗号分隔的应用 ID 列表；为空时统计所有应用。

返回示例：
```json
{
  "data": {
    "app_1": {
      "appId": "app_1",
      "count24h": 128,
      "count7d": 860,
      "count30d": 3520,
      "timeline24h": [
        { "timestamp": "2025-02-01T10:00:00.000Z", "value": 6 },
        { "timestamp": "2025-02-01T11:00:00.000Z", "value": 8 }
        // ...
      ],
      "timeline7d": [
        { "timestamp": "2025-01-27T00:00:00.000Z", "value": 120 }
        // ...
      ],
      "timeline30d": [
        { "timestamp": "2025-01-03T00:00:00.000Z", "value": 95 }
        // ...
      ]
    }
  }
}
```

> **说明**
> - `timeline24h` 以小时为粒度返回最近 24 小时的请求数。
> - `timeline7d` / `timeline30d` 以天为粒度返回最近 7/30 天的请求趋势。
> - 当 `appIds` 为空时，所有应用都会返回；指定 ID 时若无数据，也会返回计数为 0 的结构。

---

## 8. 模型配置（Model Config）

### 获取模型
`GET /api/models`

### 创建模型
`POST /api/models`
```json
{
  "name": "OpenAI 默认模型",
  "model": "gpt-4o-mini",
  "provider": "openai",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-***"
}
```

### 更新模型
`PUT /api/models/{id}`

### 删除模型
`DELETE /api/models/{id}`

---

## 9. 优化建议（Optimization Suggestion）

### 查询建议
`GET /api/optimization-suggestions?appId=app_123&status=pending`

### 更新状态
`PUT /api/optimization-suggestions/:id`
```json
{
  "status": "applied",
  "result": "已更新数据集并重新训练"
}
```

---

## 10. 典型流程

1. **记录问答**：外部系统调用 `POST /api/query-records` 注入问答日志
2. **收集反馈**：人工/AI 调用 `POST /api/feedbacks`
3. **分析命中**：周期性 `POST /api/hit-analyses`
4. **生成建议**：`POST /api/feedbacks/:id/analyze` 或命中分析结果驱动
5. **效果评估**：优化前后分别 `POST /api/evaluations`，最后 `GET /api/evaluations/compare`

---

## 11. 示例：创建问答记录并提交反馈

```bash
# 创建问答记录
curl -X POST http://localhost:10001/api/query-records \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "app_123",
    "input": "产品退款流程是什么？",
    "output": "请联系客服。",
    "modelId": "gpt-4"
  }'

# 将返回的 id 用于反馈
curl -X POST http://localhost:10001/api/feedbacks \
  -H "Content-Type: application/json" \
  -d '{
    "queryRecordId": "qr_1700000000",
    "type": "negative",
    "content": "回答过于笼统",
    "rating": 2
  }'
```

---

## 12. 相关资源

- **交互式 API 文档**：http://localhost:10001/api-docs（Swagger UI，推荐使用）
- **数据模型定义**：`docs/PROJECT_OVERVIEW.md`、`docs/design.md`
- **方案文档**：`docs/rfcs/RFC-001-应用优化平台方案.md`

> **提示**：本文档覆盖当前实现的全部 REST API。若需扩展，请同步更新此文件、Swagger 注释与相关设计文档。
