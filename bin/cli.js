#!/usr/bin/env node

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { spawn } from 'child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const serverPath = join(__dirname, '..', 'server', 'index.js')

// 启动服务器
const server = spawn('node', [serverPath], {
  stdio: 'inherit',
  shell: true
})

server.on('error', (error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})

process.on('SIGINT', () => {
  server.kill()
  process.exit(0)
})

