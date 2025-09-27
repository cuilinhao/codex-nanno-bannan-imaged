# Nano Banana 批量出图 Web 版

将原 PyQt6 桌面端「Nano banana 批量出图 V4.0」迁移为基于 Next.js + Tailwind CSS + shadcn/ui 的现代化网页应用。支持批量图片生成、Veo3 图生视频、风格库、参考图库、密钥库及统一设置管理。

## 功能全览
- **提示词管理与出图**：CSV 导入/导出、批量添加、状态追踪、双击编辑、实时缩略图预览、一键生成/重试/全量再生成。
- **图生视频任务**：批量管理 Veo3 任务，支持画幅、水印、回调、随机种子、备用模型与翻译选项，轮询状态并自动下载 MP4。
- **风格库**：新增/复制/删除、导入导出、恢复默认、字符统计，主界面一键应用风格或自定义提示语。
- **参考图库**：分类创建/重命名/删除，本地图片上传去重、网络链接引用、预览与批量删除，提示词中引用图片名自动附图。
- **密钥库**：多平台 API Key 管理、明文/脱敏展示、快速启用、同步更新设置中心。
- **设置中心**：批量出图并发/重试/保存目录、视频默认参数、自定义风格提示语统一维护。
- **后端任务调度**：Node.js 服务端复刻原异步逻辑，支持并发队列、失败自动重试、文件落地与状态持久化。

## 项目结构
```
web/
├── src/
│   ├── app/                 # Next.js App Router 页面与 API Route
│   ├── components/          # 仪表盘子模块（提示词、视频、风格、图库、密钥、设置）
│   └── lib/                 # 数据持久化、生成任务、API 封装、常量与类型定义
├── data/app-data.json       # 本地配置与任务数据（自动读写）
├── public/                  # 静态资源与生成结果落地目录
└── package.json             # 依赖与脚本
```

## 快速开始
1. 安装依赖
   ```bash
   cd web
   npm install
   ```

2. 配置环境变量
   ```bash
   # 复制环境变量模板
   cp .env.example .env.local

   # 编辑 .env.local 填入你的 KIE.AI API 密钥
   # KIE_API_KEY=your_actual_api_key_here
   ```

3. 启动开发环境（默认 http://localhost:3000）
   ```bash
   npm run dev
   ```

4. 打包构建
   ```bash
   npm run build
   npm run start
   ```

## 数据持久化
- 所有配置、提示词、图库、密钥与任务数据均写入 `web/data/app-data.json`。
- 生成的图片/视频默认保存至 `public/generated_images` 与 `public/generated_videos`；可在设置页面修改。

## 外部依赖
- **批量出图**：云雾 / API易 / apicore / KIE.AI Gemini 接口（按当前密钥平台自动切换）
- **图生视频**：KIE.AI Veo3 API

### API 密钥配置优先级
视频生成会按以下优先级查找 API 密钥：
1. `.env.local` 中的 `KIE_API_KEY`（推荐，最安全）✅
2. 设置中心的视频 API Key
3. 密钥库中平台为 KIE.AI 的密钥

### 重要提示
- ⚠️ **图片URL域名限制**：某些图片域名（如Google/Baidu CDN）可能导致连接失败
- ✅ **推荐图床**：postimg.cc、imgur.com 或自己的服务器
- 🔄 **自动重试**：连接失败时会自动重试3次，间隔递增

## 常用脚本
| 命令 | 描述 |
|------|------|
| `npm run dev` | 本地开发（热更新） |
| `npm run lint` | ESLint 静态检查 |
| `npm run build` | 生产构建（若遇中文路径问题见上文说明） |

## 许可证
沿用原项目许可。若需部署或二次开发，请确保具备第三方 API 的使用权限与额度。
