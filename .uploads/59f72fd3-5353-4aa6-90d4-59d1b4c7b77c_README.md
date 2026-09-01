# 水务监测分析系统（shuiwu）

面向中小型供水单位（县城、园区水厂）的**水务运维一体化平台**，覆盖实时监测、设备台账、分级告警、AI 智能分析与报表统计等核心业务，提供管理后台与数据可视化大屏。

## 功能特性

* **实时监测**：WebSocket 实时推送监测点压力 / 流量 / 水质等多维指标，支持趋势曲线

* **设备台账**：设备全生命周期管理，含在线状态统计

* **分级告警**：多级阈值告警规则（提示 / 警告 / 严重），自动巡检与处理

* **AI 智能分析**：自然语言查数（NL2SQL）、数据清洗、管网异常分析（离线可用）

* **报表统计**：报表生成与 Excel 导出

* **数据可视化大屏**：DataV 风格全屏大屏

* **系统管理**：用户 / 角色 / 菜单权限、平台概览统计

## 技术栈

| 端      | 技术                                                                                         |
| ------ | ------------------------------------------------------------------------------------------ |
| 后端     | Spring Boot 3.2 · MyBatis-Plus · Spring Security + JWT · Redis · Druid · EasyExcel · MySQL |
| 前端     | Vue3 · Vite · Element Plus · ECharts · Pinia · Vue Router                                  |
| AI 微服务 | FastAPI · Pydantic · PyMySQL                                                               |

## 系统架构

三端协作 + WebSocket 实时推送：

```
┌──────────────┐   HTTP / WS   ┌────────────────┐   HTTP   ┌──────────────┐
│ Vue3 前端    │ ────────────► │ Spring Boot 后端│ ──────► │ FastAPI AI   │
│ 管理后台+大屏 │ ◄──────────── │      :8080      │ ◄────── │ 微服务 :8000 │
└──────────────┘   JWT / WS    └───────┬────────┘         └──────────────┘
                                       │ JDBC / Redis
                                 ┌─────┴─────┐
                                 │ MySQL/Redis│
                                 └───────────┘
```

## 目录结构

```
shuiwu/
├── backend/        Spring Boot 后端（com.water）
├── frontend/       Vue3 前端 + 数据可视化大屏
├── ai-service/     FastAPI AI 微服务（NL2SQL / 清洗 / 异常分析）
├── docs/           API 契约 + 论文文档
├── deploy/         部署脚本（init-db / start-all / nginx 等）
├── sql/            数据库初始化脚本 shuiwu.sql
└── dev-serve.js    前端 dist 静态托管 + 反向代理预览
```

## 快速开始

**前置依赖**：JDK 17 · Maven · MySQL 8 · Redis · Node 18+ · Python 3.10+

**1. 初始化数据库**

```bash
mysql -uroot -proot < sql/shuiwu.sql
```

**2. 启动后端**（端口 `8080`，数据库/Redis 配置见 `backend/src/main/resources/application-dev.yml`）

```bash
cd backend
mvn spring-boot:run
```

**3. 启动 AI 微服务**（端口 `8000`，为后端提供 NL2SQL / 清洗 / 异常分析）

```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --port 8000
```

**4. 启动前端**

* 开发模式（端口 `5173`）：

```bash
cd frontend
npm install
npm run dev
```

* 生产预览（构建后由 `dev-serve.js` 托管静态资源并代理 `/api`、`/ws` 到后端 `8080`）：

```bash
cd frontend && npm run build
cd .. && node dev-serve.js 8081
```

## 端口一览

| 服务             | 端口       |
| -------------- | -------- |
| Spring Boot 后端 | 8080     |
| Vite 开发服务器     | 5173     |
| 前端生产预览         | 8081（默认） |
| FastAPI AI 微服务 | 8000     |

## 默认账号

| 账号       | 密码     | 角色  |
| -------- | ------ | --- |
| admin    | 123456 | 管理员 |
| operator | 123456 | 运维员 |
| viewer   | 123456 | 观察员 |

## 文档

* 文档索引：[`docs/README.md`](shuiwu/docs/README.md)

* API 契约：[`docs/APICONTRACT.md`](shuiwu/docs/APICONTRACT.md)

* 论文章节：`docs/thesis/ch3_系统需求分析.md` ~ `ch6_系统测试.md`

