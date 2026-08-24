# KeyGo Web (React)

激活码分发管理系统前端，基于 React 19 + TypeScript + Vite + Ant Design 构建。

## 功能特性

- **用户认证**：登录 / 注册（管理员审核）/ 登出 / 修改密码，基于 Spring Security Cookie + remember-me
- **激活码申领**：单个申领、批量申领（1-100），支持选择使用单位写入备注
- **我的记录**：查看当前用户已申领的激活码列表，支持复制
- **激活码管理**（管理员）：分页查询、状态筛选、关键词搜索、标记使用/未使用、批量操作、删除、Excel 导入导出、备注编辑
- **用户管理**（管理员）：待审核用户列表、审核通过/拒绝、角色变更、删除用户
- **操作日志**（管理员）：分页查看系统操作记录
- **公告管理**：公告列表、发布公告（支持置顶）、删除公告
- **使用单位管理**：单位列表、手动添加、文件批量导入（.txt/.csv/.xlsx）、删除
- **响应式布局**：桌面端顶部导航 + 移动端底部 Tab Bar，滑动指示器动画
- **主题系统**：浅色 / 暗色 / 自动跟随系统，渲染前初始化避免闪白
- **Liquid Glass 设计语言**：毛玻璃效果、圆角、柔和阴影

## 技术栈

- [React 19](https://react.dev/) — UI 框架
- [TypeScript 5.9](https://www.typescriptlang.org/) — 类型安全
- [Vite 8](https://vite.dev/) — 构建工具
- [Ant Design 5](https://ant.design/) — UI 组件库（配合 `@ant-design/v5-patch-for-react-19`）
- [Zustand 5](https://zustand.docs.pmnd.rs/) — 状态管理
- [React Router 8](https://reactrouter.com/) — 客户端路由
- [Axios](https://axios-http.com/) — HTTP 客户端（Cookie 认证，`withCredentials: true`）
- [ESLint 10](https://eslint.org/) + [Prettier](https://prettier.io/) — 代码规范

## 项目结构

```
src/
├── main.tsx                  # 应用入口（StrictMode + antd reset.css + 全局样式）
├── App.tsx                   # 根组件（ConfigProvider 主题 + AntdApp + BrowserRouter + 路由）
├── router/
│   ├── AppRoutes.tsx         # 路由表 + 登录/管理员权限守卫 + 懒加载 + 页面切换动画
│   └── navigation.ts         # 导航桥接（供 api 层 401 触发跳转 / 清理登录态）
├── stores/                   # Zustand 状态
│   ├── auth.ts               # 认证状态（用户信息、会话恢复、登录/登出、角色选择器）
│   └── theme.ts              # 主题状态（auto/light/dark，localStorage 持久化，系统偏好监听）
├── api/                      # 后端接口层
│   ├── request.ts            # Axios 实例 + 统一响应解包 + 401 全局拦截 + 友好错误提示
│   ├── auth.ts               # 认证 API（登录、登出、注册、获取当前用户、修改密码）
│   ├── codes.ts              # 激活码 API（申领、批量申领、列表、标记、删除、导入导出、我的记录）
│   ├── users.ts              # 用户管理 API（待审核、列表、审核、角色、删除）
│   ├── logs.ts               # 日志与公告 API
│   └── units.ts              # 使用单位 API（含后端字段归一化兼容）
├── components/               # 公共组件
│   ├── AppLayout.tsx         # 主布局（导航栏 + 移动端 Tab Bar + 用户菜单 + 主题切换）
│   ├── AppIcon.tsx           # 内联 SVG 图标组件
│   └── PasswordModal.tsx     # 修改密码弹窗
├── views/                    # 页面组件（均为路由懒加载）
│   ├── LoginView.tsx         # 登录 / 注册页
│   ├── FetchView.tsx         # 激活码申领页（单个 + 批量 + 使用单位选择）
│   ├── MyCodesView.tsx       # 我的激活码记录
│   ├── ListView.tsx          # 激活码查询管理（管理员）
│   ├── LogsView.tsx          # 操作日志（管理员）
│   └── AdminView.tsx         # 管理后台（用户管理 + 公告管理 + 使用单位管理）
├── composables/
│   └── usePasswordModal.ts   # 密码弹窗组合状态（Zustand）
├── utils/
│   ├── index.ts              # 通用工具（时间格式化、剪贴板复制、角色/操作标签映射）
│   ├── messageBridge.ts      # 全局 message 桥接（供非组件代码调用 antd message）
│   └── antdAppBridge.ts      # AntdApp 实例桥接（message / modal / confirm）
├── types/
│   └── index.ts              # 全局类型定义（UserInfo、ActivationCode、OperationLog 等）
└── styles/
    └── main.css              # 全局样式（Liquid Glass 设计系统 + CSS 变量主题）
```

## 路由与权限

| 路径 | 页面 | 权限要求 |
|------|------|----------|
| `/login` | 登录 / 注册 | 公开（已登录自动跳转 `/fetch`） |
| `/fetch` | 激活码申领 | 登录用户 |
| `/mycodes` | 我的记录 | 登录用户 |
| `/list` | 激活码查询 | 管理员 |
| `/logs` | 操作日志 | 管理员 |
| `/admin` | 管理后台 | 管理员 |

- 未登录访问受保护页面时，先尝试通过 `/api/v1/admin/users/me` 恢复会话（只查一次，多守卫共享 Promise）
- 会话失效（401）由 Axios 拦截器全局处理：清理本地登录态 → 提示 → 跳转登录页（防抖，避免多请求重复弹窗）
- 非管理员访问管理员页面 → 已登录跳转 `/fetch`，未登录跳转 `/login`

## 后端对接

### 开发环境代理

Vite dev server 将 `/api/v1/*` 代理转发到后端：

```
/api/v1/* -> http://localhost:18080
```

### 认证方式

Cookie 认证（Spring Security 表单登录 + remember-me），所有请求携带 `withCredentials: true`，无需手动管理 token。

### 统一响应格式

后端返回 `{ code, message, data }`，Axios 响应拦截器自动解包：
- `code === 0` → 成功，直接返回 `data`
- 其他 → 业务错误，reject 携带后端 `message`

### 生产环境

通过 `.env.production` 中的 `VITE_API_BASE_URL` 指定后端地址（默认空，同源部署）。

### 主要 API 端点

| 模块 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 认证 | POST | `/api/v1/auth/login` | 表单登录 |
| 认证 | POST | `/api/v1/auth/logout` | 登出 |
| 认证 | POST | `/api/v1/auth/register` | 注册（需审核） |
| 认证 | GET | `/api/v1/admin/users/me` | 当前用户信息 |
| 认证 | PATCH | `/api/v1/admin/users/password` | 修改密码 |
| 激活码 | GET | `/api/v1/codes/stats` | 公共统计 |
| 激活码 | POST | `/api/v1/codes/claim` | 单个申领 |
| 激活码 | POST | `/api/v1/codes/batch-claim` | 批量申领 |
| 激活码 | GET | `/api/v1/codes/my-codes` | 我的记录 |
| 激活码 | GET | `/api/v1/admin/codes` | 列表（分页+筛选） |
| 激活码 | PATCH | `/api/v1/admin/codes/{id}/use` | 标记已使用 |
| 激活码 | PATCH | `/api/v1/admin/codes/{id}/unuse` | 标记未使用 |
| 激活码 | DELETE | `/api/v1/admin/codes/{id}` | 删除 |
| 激活码 | POST | `/api/v1/admin/codes/import` | Excel 导入 |
| 激活码 | POST | `/api/v1/admin/codes/export` | Excel 导出 |
| 用户 | GET | `/api/v1/admin/users/pending` | 待审核列表 |
| 用户 | GET | `/api/v1/admin/users` | 用户列表 |
| 用户 | PATCH | `/api/v1/admin/users/{id}/approve` | 审核通过 |
| 用户 | PATCH | `/api/v1/admin/users/{id}/reject` | 审核拒绝 |
| 用户 | PATCH | `/api/v1/admin/users/{id}/role` | 角色变更 |
| 用户 | DELETE | `/api/v1/admin/users/{id}` | 删除用户 |
| 日志 | GET | `/api/v1/admin/codes/logs` | 操作日志 |
| 公告 | GET | `/api/v1/announcements` | 公告列表 |
| 公告 | POST | `/api/v1/announcements` | 发布公告 |
| 公告 | DELETE | `/api/v1/announcements/{id}` | 删除公告 |
| 单位 | GET | `/api/v1/units` | 单位列表 |
| 单位 | POST | `/api/v1/admin/units` | 添加单位 |
| 单位 | POST | `/api/v1/admin/units/import` | 批量导入 |
| 单位 | DELETE | `/api/v1/admin/units/{id}` | 删除单位 |

## 构建优化

- **CDN 外部化**：React、React DOM、antd、@ant-design/icons、@ant-design/v5-patch-for-react-19 通过 `index.html` 中的 importmap 从 esm.sh 加载，构建时 `rollupOptions.external` 排除，显著减小产物体积
- **路由懒加载**：所有页面组件通过 `React.lazy` + `Suspense` 按需加载
- **手动分块**：`node_modules` 依赖单独打包为 `vendor` chunk
- **构建目标**：`es2022`，利用现代浏览器原生支持

## 环境要求

- Node.js `^22.18.0 || >=24.12.0`（见 `package.json` engines）
- npm（随 Node 安装）

## 快速开始

```sh
# 安装依赖
npm install

# 启动开发服务器（http://localhost:5173）
npm run dev

# 类型检查
npm run type-check

# 代码检查与自动修复
npm run lint

# 代码格式化
npm run format

# 构建生产包（输出到 dist/）
npm run build

# 预览生产构建
npm run preview
```

## 可用脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器 |
| `npm run build` | 先执行 `tsc -b` 类型检查，再执行 `vite build` 生产构建 |
| `npm run preview` | 本地预览生产构建产物 |
| `npm run type-check` | 仅执行 TypeScript 类型检查（`tsc -b`） |
| `npm run lint` | ESLint 检查并自动修复，启用缓存 |
| `npm run format` | Prettier 格式化 `src/` 目录 |

## 许可证

Private
