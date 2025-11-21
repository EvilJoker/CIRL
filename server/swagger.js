import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CIRL API',
      version: '1.0.0',
      description: 'CIRL 应用问答优化平台 API 文档\n\n' +
        'CIRL 是一个面向 AI 应用/知识库的问答监控与优化平台，提供完整的问答记录、反馈闭环、数据集管理、命中分析和效果评估功能。',
      contact: {
        name: 'CIRL API Support'
      },
      license: {
        name: 'MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: '本地开发环境'
      },
      {
        url: 'https://api.cirl.example.com',
        description: '生产环境'
      }
    ],
    tags: [
      {
        name: 'Apps',
        description: '应用管理 API'
      },
      {
        name: 'QueryRecords',
        description: '问答记录 API'
      },
      {
        name: 'Feedbacks',
        description: '反馈管理 API'
      },
      {
        name: 'Datasets',
        description: '数据集管理 API'
      },
      {
        name: 'HitAnalyses',
        description: '命中分析 API'
      },
      {
        name: 'Evaluations',
        description: '效果评估 API'
      },
      {
        name: 'OptimizationSuggestions',
        description: '优化建议 API'
      }
    ],
    components: {
      schemas: {
        App: {
          type: 'object',
          required: ['id', 'name', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              description: '应用唯一标识',
              example: 'app_1234567890'
            },
            name: {
              type: 'string',
              description: '应用名称',
              example: 'Support Copilot'
            },
            description: {
              type: 'string',
              description: '应用描述',
              example: '客服 FAQ 问答助手'
            },
            metadata: {
              type: 'object',
              description: '扩展元数据',
              additionalProperties: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: '创建时间'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: '更新时间'
            }
          }
        },
        QueryRecord: {
          type: 'object',
          required: ['id', 'appId', 'input', 'output', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              description: '问答记录唯一标识',
              example: 'qr_1234567890'
            },
            appId: {
              type: 'string',
              description: '关联的应用ID',
              example: 'app_1234567890'
            },
            input: {
              type: 'string',
              description: '用户输入的问题',
              example: '如何重置密码？'
            },
            output: {
              type: 'string',
              description: '应用输出的回答',
              example: '请打开设置 > 安全 > 密码，按照向导完成重置。'
            },
            modelId: {
              type: 'string',
              description: '使用的模型标识',
              example: 'gpt-4o-mini'
            },
            context: {
              type: 'object',
              description: '上下文信息',
              additionalProperties: true
            },
            curated: {
              type: 'boolean',
              description: '是否已精选',
              default: false
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: '标签列表'
            },
            ignored: {
              type: 'boolean',
              description: '是否已忽略',
              default: false
            },
            metadata: {
              type: 'object',
              description: '元数据',
              properties: {
                responseTime: {
                  type: 'number',
                  description: '响应时间（毫秒）'
                },
                lastAnalyzedAt: {
                  type: 'string',
                  format: 'date-time'
                },
                lastMatchType: {
                  type: 'string',
                  enum: ['exact', 'high', 'medium', 'none']
                },
                lastSimilarity: {
                  type: 'number',
                  description: '相似度（0-100）'
                }
              },
              additionalProperties: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Feedback: {
          type: 'object',
          required: ['id', 'queryRecordId', 'type', 'status', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              example: 'fb_1234567890'
            },
            queryRecordId: {
              type: 'string',
              description: '关联的问答记录ID'
            },
            type: {
              type: 'string',
              enum: ['positive', 'negative', 'neutral', 'correction'],
              description: '反馈类型'
            },
            content: {
              type: 'string',
              description: '反馈内容'
            },
            rating: {
              type: 'integer',
              minimum: 1,
              maximum: 5,
              description: '评分（1-5）'
            },
            correction: {
              type: 'string',
              description: '纠正后的答案（当 type 为 correction 时）'
            },
            status: {
              type: 'string',
              enum: ['pending', 'processed', 'resolved'],
              description: '处理状态'
            },
            processedAt: {
              type: 'string',
              format: 'date-time'
            },
            resolution: {
              type: 'string',
              description: '处理方案'
            },
            optimizationSuggestion: {
              type: 'string',
              description: '优化建议'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Dataset: {
          type: 'object',
          required: ['id', 'appId', 'name', 'queryRecordIds', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              example: 'ds_1234567890'
            },
            appId: {
              type: 'string',
              description: '关联的应用ID'
            },
            name: {
              type: 'string',
              description: '数据集名称'
            },
            description: {
              type: 'string',
              description: '数据集描述'
            },
            queryRecordIds: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: '包含的问答记录ID列表'
            },
            metadata: {
              type: 'object',
              additionalProperties: true
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        HitAnalysis: {
          type: 'object',
          required: ['id', 'queryRecordId', 'datasetId', 'matchType', 'similarity', 'createdAt'],
          properties: {
            id: {
              type: 'string',
              example: 'ha_1234567890'
            },
            queryRecordId: {
              type: 'string',
              description: '问答记录ID'
            },
            datasetId: {
              type: 'string',
              description: '数据集ID'
            },
            matchType: {
              type: 'string',
              enum: ['exact', 'high', 'medium', 'none'],
              description: '匹配类型：完全命中、80%相似、60%相似、未命中'
            },
            similarity: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: '相似度（0-100）'
            },
            matchedQueryRecordId: {
              type: 'string',
              description: '匹配到的数据集中的问答记录ID'
            },
            analysisResult: {
              type: 'string',
              description: 'AI 分析结果'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Evaluation: {
          type: 'object',
          required: ['id', 'appId', 'datasetId', 'evaluationType', 'metrics', 'queryRecordIds', 'evaluatedAt', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              example: 'ev_1234567890'
            },
            appId: {
              type: 'string'
            },
            datasetId: {
              type: 'string'
            },
            evaluationType: {
              type: 'string',
              enum: ['before', 'after'],
              description: '评估类型：优化前或优化后'
            },
            metrics: {
              type: 'object',
              required: ['accuracy', 'speed', 'exactHitRate', 'highHitRate', 'mediumHitRate', 'noHitRate', 'avgRating', 'feedbackCount'],
              properties: {
                accuracy: {
                  type: 'number',
                  description: '准确率（0-100）'
                },
                speed: {
                  type: 'number',
                  description: '速度（毫秒）'
                },
                exactHitRate: {
                  type: 'number',
                  description: '完全命中率（%）'
                },
                highHitRate: {
                  type: 'number',
                  description: '80%相似命中率（%）'
                },
                mediumHitRate: {
                  type: 'number',
                  description: '60%相似命中率（%）'
                },
                noHitRate: {
                  type: 'number',
                  description: '未命中率（%）'
                },
                avgRating: {
                  type: 'number',
                  description: '平均评分'
                },
                feedbackCount: {
                  type: 'integer',
                  description: '反馈数量'
                }
              }
            },
            queryRecordIds: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: '参与评估的问答记录ID列表'
            },
            evaluatedAt: {
              type: 'string',
              format: 'date-time'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        OptimizationSuggestion: {
          type: 'object',
          required: ['id', 'appId', 'source', 'sourceId', 'priority', 'content', 'status', 'createdAt', 'updatedAt'],
          properties: {
            id: {
              type: 'string',
              example: 'opt_1234567890'
            },
            appId: {
              type: 'string'
            },
            source: {
              type: 'string',
              enum: ['feedback', 'hit-analysis', 'evaluation'],
              description: '来源：反馈、命中分析、评估'
            },
            sourceId: {
              type: 'string',
              description: '来源ID'
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: '优先级'
            },
            content: {
              type: 'string',
              description: '优化建议内容'
            },
            status: {
              type: 'string',
              enum: ['pending', 'applied', 'rejected'],
              description: '状态'
            },
            appliedAt: {
              type: 'string',
              format: 'date-time'
            },
            result: {
              type: 'string',
              description: '应用结果'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: '错误信息'
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/QueryRecord'
              }
            },
            total: {
              type: 'integer',
              description: '总记录数'
            },
            page: {
              type: 'integer',
              description: '当前页码'
            },
            pageSize: {
              type: 'integer',
              description: '每页大小'
            }
          }
        }
      }
    }
  },
  apis: ['./server/index.js'] // 指向包含 JSDoc 注释的文件
}

export const swaggerSpec = swaggerJsdoc(options)

