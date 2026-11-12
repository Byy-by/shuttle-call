# 校园班车呼叫系统

> 面向校园学生与班车司机的实时呼叫系统。学生选择站点并发起呼叫，司机可以查看待处理任务、接单并标记到达。

## 项目简介

校园班车呼叫系统用于连接候车学生与班车司机。学生端可以查看站点、填写姓名并发送呼叫；司机端会自动刷新待处理呼叫，并完成接单、到达等状态流转。

项目采用前后端分离结构，通过 npm workspaces 统一管理依赖，并使用 `concurrently` 同时启动前端和后端。

## 技术栈

| 层级 | 技术 | 说明 |
| --- | --- | --- |
| 前端 | React 19 | 构建学生端和司机端界面 |
| 前端构建 | Vite 7 | 开发服务器与生产构建 |
| 样式 | Tailwind CSS 4 | 页面布局和组件样式 |
| 路由 | React Router DOM 7 | 配置学生端和司机端页面路由 |
| 后端 | Node.js + Express 4 | 提供 REST API |
| 数据库 | SQLite + better-sqlite3 | 本地数据持久化 |
| 工程工具 | npm workspaces + concurrently | 依赖管理与前后端联合启动 |

## 核心功能

- **站点选择**：学生端从数据库加载所有校车站点。
- **发起呼叫**：学生选择站点、填写姓名后创建一个等待中的呼叫。
- **司机任务列表**：展示待处理呼叫的站点、学生姓名和呼叫时间。
- **实时轮询**：司机端每 5 秒自动刷新待处理列表，无需手动刷新页面。
- **司机接单**：事务性校验呼叫和司机状态，接单后司机进入忙碌状态。
- **到达确认**：司机标记到达后，呼叫完成，司机恢复空闲状态。
- **状态约束**：阻止重复接单、重复到达以及非空闲司机接单。
- **模拟数据**：提供可重复执行的数据库种子脚本。

业务流程：

```text
学生发起呼叫 → waiting → 司机接单 → accepted → 司机标记到达 → arrived
```

## 快速开始

### 环境要求

- Node.js 22 或更高版本
- npm 10 或更高版本

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

首次运行时，建议创建数据表并插入模拟数据：

```bash
npm run db:seed
```

该命令可以重复执行，不会重复插入相同的模拟记录。如果只需要创建数据表，可以运行：

```bash
npm run db:init
```

服务启动时也会自动确保数据表存在。默认数据库文件位于 `server/data/shuttle.db`。

### 3. 启动项目

```bash
npm run dev
```

该命令会同时启动前端和后端：

| 服务 | 地址 |
| --- | --- |
| 学生端 | <http://localhost:5173> |
| 司机端 | <http://localhost:5173/driver> |
| 后端 API | <http://localhost:3001> |
| 健康检查 | <http://localhost:3001/api/health> |

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 同时启动前端和后端 |
| `npm run dev:server` | 仅启动后端开发服务器 |
| `npm run dev:client` | 仅启动前端开发服务器 |
| `npm run db:init` | 创建或补齐数据库表 |
| `npm run db:seed` | 建表并插入模拟数据 |
| `npm run build` | 构建前端生产资源 |
| `npm start` | 以普通模式启动后端 |

## 目录结构

```text
shuttle-call/
├── client/
│   ├── src/
│   │   ├── App.jsx          # 学生端页面
│   │   ├── Driver.jsx       # 司机端页面与自动轮询
│   │   ├── main.jsx         # React 入口与路由配置
│   │   └── index.css        # Tailwind CSS 入口
│   ├── index.html
│   ├── vite.config.js       # Vite 配置及 /api 代理
│   └── package.json
├── server/
│   ├── data/                # SQLite 数据文件目录
│   ├── db.js                # 数据库初始化与迁移
│   ├── index.js             # Express 服务入口
│   ├── routes.js            # API 路由与业务逻辑
│   ├── seed.js              # 模拟数据脚本
│   └── package.json
├── package.json             # workspace 与统一脚本
├── package-lock.json
└── README.md
```

## 核心 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/stations` | 获取所有校车站点 |
| `GET` | `/api/calls/pending` | 获取等待中的呼叫，包含站点名称 |
| `POST` | `/api/calls` | 创建呼叫，接收 `station_id` 和 `student_name` |
| `PATCH` | `/api/calls/:id/accept` | 司机接单，接收 `driver_id` |
| `PATCH` | `/api/calls/:id/arrive` | 标记到达，接收 `driver_id` |
| `GET` | `/api/health` | 后端健康检查 |

## 数据库

默认数据库包含以下三张核心表：

- `stations`：校车站点
- `drivers`：司机与车辆状态
- `calls`：学生呼叫、状态流转及时间记录

可通过环境变量覆盖数据库文件位置：

```powershell
$env:DATABASE_PATH = "C:\path\to\shuttle.db"
npm run dev
```
