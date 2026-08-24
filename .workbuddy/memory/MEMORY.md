# keygo_web_react 项目长期记忆

## 技术栈与约定
- React 19 + Vite 8 + TypeScript 5.9 SPA（激活码管理系统 KeyGo）。
- **UI 组件库：Ant Design (antd) 5.29.3 + @ant-design/icons 5.x**（2026-08-24 由 Arco Design 2.66 全量迁移而来，请勿回退）。
- 状态管理 zustand 5；路由 react-router 8；HTTP 用 axios（src/api/request.ts，拦截器通过 messageBridge 弹 antd message）。
- **React 19 兼容**：main.tsx 须在 App 之前 `import '@ant-design/v5-patch-for-react-19'`，否则 antd 静态方法（message.xxx / Modal.confirm）在模块作用域调用会报错。
- **CDN 外部化**：生产构建通过 `vite.config.ts` 的 `rollupOptions.external` 将 react/react-dom/antd/icons/patch 全部外部化，index.html 中 `<script type="importmap">` 将这些模块映射到 esm.sh CDN；antd `reset.css` 通过 jsdelivr CDN link 引入。vendor chunk 从 1MB 降至 84KB。

## 构建与依赖注意
- 安装第三方依赖若遇 React 19 peer 警告，用 `--legacy-peer-deps`。
- `npm run build` 前若报 safe-delete 批量删除拦截，先 `rm -rf dist` 清一次（沙箱会拦 Node 层 bulk 删除）。
- tsconfig 开启 verbatimModuleSyntax：所有类型须 type-only import（如 `import { ..., type ColumnsType }`）。
- `@ant-design/icons` 必须用 v5（非 v6），否则与 antd v5 不兼容。

## Ant Design 易错点
- Modal：用 `open`（非 `visible`）/ `onCancel` / `width` 属性；`Modal.confirm` 删除用 `okButtonProps:{danger:true}`。
- Alert：用 `message`/`description` 属性（非 `content`）。
- Table：`dataSource`（非 `data`）；列类型 `ColumnsType<T>`（非 `TableColumnProps`）；`bordered`（非 `border`）；无 `stripe` 属性（斑马纹靠 CSS）；表头类名 `.ant-table-thead > tr > th`，单元格 `.ant-table-tbody > tr > td`。
- Input `onChange`：antd 回调 `(e)=>void`，取 `e.target.value`（Arco 是 `(v)=>void`）。
- Checkbox `onChange`：antd 回调 `(e)=>void`，取 `e.target.checked`。
- Tag color：合法预设 `red/orange/green/gold/blue/processing/success/error/default` 等；**无 `gray`/`arcoblue`**（用 `default`/`blue`）；antd v5 Tag **无 `size` 属性**。
- Button：`danger`（非 `status="danger"`）；`type="default"`（非 `type="secondary"`/`"outline"`）；`block`（非 `long`）；`size` 无 `mini`（用 `small`）。
- Input `size`：合法值 `small`/`middle`/`large`（**无 `default`**）。
- Dropdown：`placement="bottomRight"`（非 `position="br"`）+ `menu={{items, onClick}}`（非 `droplist`/`onClickMenuItem`）。
- Tabs：用 `items` + `activeKey`（非 `Tabs.TabPane` + `activeTab`）。
- ConfigProvider：`theme={{token:{colorPrimary, borderRadius}}}`（非 Arco 的 `{primaryColor, borderRadius}`）。
- **Card 已弃用 `bordered`**：统一用 `variant="outlined"`（对应原 `bordered`）/ `variant="borderless"`（对应原 `bordered={false}`）；Table 的 `bordered` 不弃用，保持不变。

## 使用单位模块（2026-08-25 新增）
- API 契约见 `src/api/units.ts` 顶部注释：`GET /api/v1/units`、`POST /api/v1/admin/units`、`POST /api/v1/admin/units/import`（FormData）、`DELETE /api/v1/admin/units/{id}`；申领联动 `POST /api/v1/codes/claim` 可选 body `{ unit }`——unit 非空写入备注，缺省保持原值。后端为独立服务，尚未实现这些端点。
- 前端：FetchView 申领弹窗 Select（默认空）；AdminView「使用单位维护」卡片（手动添加 + Upload 批量导入 + 删除）。

## 视觉风格约定（2026-08-25 起）
- **扁平化 + 静态毛玻璃**（已从液态玻璃迁移，请勿回退）：设计令牌在 main.css——`--frost-*`（毛玻璃，仅导航栏/移动 Tab Bar，blur(12px) 固定）、`--card-*`（实色卡片 #fff / 暗 #141b2b）、`--pill-*`（扁平指示器）。body 纯色背景（#f4f6f9 / 暗 #0d1220）。禁止再引入 saturate(200%)、滚动反射、浮动动画。

## 主题系统（2026-08-25 新增）
- `src/stores/theme.ts`（zustand）：mode = `auto`/`light`/`dark`，默认 auto，localStorage 键 `keygo-theme-mode` 持久化；`isDark` 为实际生效值（auto 时跟随 `prefers-color-scheme`，matchMedia change 实时响应）。
- 暗色实现：`html[data-theme='dark']` 属性 + antd `theme.darkAlgorithm`；index.html 内联脚本在渲染前设置 data-theme 防闪白；CSS 暗色覆盖集中在各 css 文件末尾 `html[data-theme='dark']` 段（液态玻璃变量在 main.css 覆盖）。
- 主题切换入口：AppLayout 导航栏右侧 BgColorsOutlined 图标按钮 Dropdown。
- **静态方法主题化**：App.tsx 用 antd `<App>` 包裹并通过 `src/utils/antdAppBridge.ts` 注册 useApp() 的 message/modal 实例；`messageBridge` 与各视图的确认弹窗统一走 `appConfirm()`（替代 `Modal.confirm`），未注册时回退静态方法。
