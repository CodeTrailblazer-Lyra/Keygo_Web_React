# keygo_web_react 项目长期记忆

## 技术栈与约定
- React 19 + Vite 8 + TypeScript 5.9 SPA（激活码管理系统 KeyGo）。
- **UI 组件库：Ant Design (antd) 5.29.3 + @ant-design/icons 5.x**（2026-08-24 由 Arco Design 2.66 全量迁移而来，请勿回退）。
- 状态管理 zustand 5；路由 react-router 8；HTTP 用 axios（src/api/request.ts，拦截器通过 messageBridge 弹 antd message）。
- **React 19 兼容**：main.tsx 须在 App 之前 `import '@ant-design/v5-patch-for-react-19'`，否则 antd 静态方法（message.xxx / Modal.confirm）在模块作用域调用会报错。
- **全部本地打包（2026-08-25）**：之前用 `<script type="importmap">` 把 react/react-dom/antd/icons/patch 映射到 esm.sh CDN、antd `reset.css` 走 jsdelivr；生产环境 esm.sh 被防火墙拦截，页面卡在加载动画。现已切回全量本地打包——index.html 不再引入任何 CDN，`antd/dist/reset.css` 改为在 main.tsx 中 import。vendor 按 advancedChunks 三层拆分：react-core 190KB / antd 932KB / vendor 88KB（合计 ~1210KB raw / ~387KB gzip / ~314KB brotli）。

## 构建与依赖注意
- 安装第三方依赖若遇 React 19 peer 警告，用 `--legacy-peer-deps`。
- `npm run build` 前若报 safe-delete 批量删除拦截，先 `rm -rf dist` 清一次（沙箱会拦 Node 层 bulk 删除）。
- tsconfig 开启 verbatimModuleSyntax：所有类型须 type-only import（如 `import { ..., type ColumnsType }`）。
- `@ant-design/icons` 必须用 v5（非 v6），否则与 antd v5 不兼容。
- **预压缩**：`scripts/compress.mjs` 在 vite build 后跑一遍，dist 下生成 .gz（level 9）+ .br（quality 11），零三方依赖。nginx 需 `gzip_static on;` + `brotli_static on;` 才会命中。
- **Vite 8 / rolldown 分包关键**（2026-08-25 踩坑）：`rollupOptions.output` 必须同时设 `strictExecutionOrder: true` 才能安全启用 `advancedChunks` 分组。否则 react（仍为 CJS）的互操作辅助函数会被 rolldown 与业务共享模块（如 src/api/request.ts）合入同一 chunk，形成 `vendor ↔ request` 跨 chunk 循环依赖，浏览器加载时按环解析，react 拿到的 `f/m/p` 辅助符号还是 `var` 暂未初始化，**`Uncaught TypeError: e is not a function at react-core-xxx.js:1`**，页面卡在加载动画。开启 strictExecutionOrder 后，rolldown 会把运行时辅助函数抽到独立的 `rolldown-runtime-*.js` 叶子 chunk，依赖图变成干净 DAG——**react-core / antd / vendor 三层拆分因此可用且已实测验证**（check-chunk-cycles + 无头 Chrome 渲染均通过）。`scripts/check-chunk-cycles.mjs` 已挂进 build 脚本做防回归。

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

## 动画系统（2026-08-25 重构）
- 库：**Motion（framer-motion，motion@13.1.1）**，`import ... from 'motion/react'`。Ant Motion 的 rc-* 因 `findDOMNode` 与 React 19 不兼容，**禁用**。
- 统一令牌：`src/anim/motion.ts` 集中定义 `durations`（instant/fast/micro/base/page/slow）与 `easings`（out/inOut/emphasis/gentle），全应用共享，禁止各处硬编码时长/缓动。
- **节奏与缓动调校（2026-08-26）**：整体放慢约 1.5×（base 0.28→0.42、page 0.22→0.34、list duration 0.34→0.5、AnimatedNumber 0.5→0.8）；缓动全部改为带回弹过冲的 easeOutBack 曲线（out [0.34,1.56,0.64,1]、emphasis [0.34,1.8,0.5,1]、gentle [0.34,1.34,0.64,1]），营造「Q 弹 / 回弹」质感；退出与持续过程仍用 inOut 干净收尾，避免晃动。仅调速度参数与缓动，未改核心逻辑/视觉风格。
- 过渡形式 `AnimEffect = 'up' | 'fade' | 'scale' | 'right' | 'left'`，由 `contentVariants(effect)` 生成 variants；场景差异化：页面切换=上移渐显、内容卡片=上移渐入、公告列表=左滑入、统计数字=补间滚动（AnimatedNumber）、激活码/结果=CSS pop-in 回弹、弹窗=antd 自带 zoom。
- 组件：`FadeIn`（effect/delay/y/x/refreshKey，内容渐入与数据刷新过渡）、`AnimatedList`/`AnimatedItem`（effect 错峰入场 + FLIP 退场）、`AnimatedNumber`（数值补间）。
- **页面切换**：`src/router/AppRoutes.tsx` 的 `AnimatedOutlet` 用 `AnimatePresence mode="wait"`（串行、不重叠、无闪烁/错位）+ `ScrollResetOnMount`（新页面挂载时 `window.scrollTo(0,0)` 复位滚动，避免残留状态）。
- **系统公告卡片**：AdminView 的「系统公告」卡整体作为单元 `FadeIn` 渐入；内部列表项**不再逐项入场**，仅保留展开/收起（高度动画）与删除时 `AnimatePresence initial={false}` + `layout` 的平滑回流（属状态变化，非入场逐项触发）。
- **无障碍**：`App.tsx` 根部 `MotionConfig reducedMotion="user"`；`FadeIn`/`AnimatedList`/`AnimatedNumber` 均显式 `useReducedMotion()` 降级为纯渲染；`main.css` 还有 `@media (prefers-reduced-motion: reduce)` 兜底关闭 CSS 过渡/动画。
- **页面切换滑动（2026-08-26 调优）**：`AppRoutes.tsx` 的 `AnimatedOutlet` 用**方向感知的整页左右滑动**——`slideVariants`（enter/exit 用 x:±16% + opacity，custom 下发方向）+ `pageSlideTransition`（平滑 easeInOut，页面级不宜回弹）；方向由 `ROUTE_ORDER`（`/fetch,/mycodes,/list,/logs,/admin`，与导航顺序一致）比对上一路由得到，前进(索引增大)向左滑、后退向右滑；`initial={false}` 首屏不滑入。**性能优化（同日）**：由 `mode="popLayout"`（新旧两页同时挂载、对重型 antd Table 造成掉帧/卡顿）改为 `mode="wait"`（旧页完整退场后新页再入场，同一时刻仅一个页面在 DOM，彻底消除双份重型内容挂载的卡顿）；同时移除 motion.div 上常驻的 `willChange` 图层，仅用 transform+opacity 合成（GPU 友好、不触发重排）；位移幅度收小到 16% 让切换更利落。
- **查询页列表加载丝滑化（2026-08-26）**：`ListView` 原用 `<FadeIn refreshKey={refreshToken}>` 会在每次刷新**重挂载整张 antd Table**（列宽重算/固定列回流 → 卡顿）。改为常驻 `<div className="table-scroll" ref>` + 数据刷新时轻量 opacity 淡入。
  - **v1（初版）**：`useEffect([refreshToken])` 切换 `.table-fade-in` 类（移除→强制回流 `void el.offsetWidth`→重加）重触发 CSS `tableFadeIn`(0.35→1)。
  - **v2（再优化，切页仍卡顿时）**：改用 **Web Animations API** `el.animate([{opacity:0.35},{opacity:1}], {duration:300, easing:'cubic-bezier(0.16,1,0.3,1)', fill:'both'})` 重启淡入——**不再触发同步 reflow**，避免重型 Table 在页面滑动入场期间被强制重排掉帧；并用 `fadeMountedRef` **跳过首次挂载(loading 骨架态)的冗余淡入**，仅真实数据到达/筛选/翻页时淡入；同时 `matchMedia('(prefers-reduced-motion: reduce)')` 时跳过动画。原 CSS `.table-fade-in`/`@keyframes tableFadeIn` 已删除。
  - **路由分包预加载**：`AppRoutes` 在 `requestIdleCallback`(兜底 setTimeout 1200ms) 时 `import()` 全部视图 chunk，消除「页面滑入空白 → 等 lazy chunk → 内容突现」的卡顿感；视图 chunk 极小、无顶层副作用，预加载安全。
- **弹窗打开整页横移修复（2026-08-26）**：antd 滚动锁定（rc-util scrollLocker）会给 `<body>` 加 `width:calc(100% - 15px)` + `overflow:hidden`（类 `ant-scrolling-effect`）。本应用滚动容器是 `<html>`，该收窄使居中 `.page-container` 左右闪动。修复：`main.css` 加 `body.ant-scrolling-effect{width:100% !important}`，仅消除位移、保留滚动锁定，开关弹窗不再跳动。
- **弹窗统一居中（2026-08-26）**：antd Modal 默认 `top:100px`（仅水平居中、垂直偏上），Modal.confirm/appConfirm 确认弹窗亦无垂直居中，各入口不统一。`main.css` 加 `.ant-modal-wrap{display:flex !important; padding:16px !important}` + `.ant-modal{top:0 !important; margin:auto !important; padding-bottom:0 !important; max-width:calc(100vw - 32px) !important}`——flex 子项 auto margin 实现水平+垂直居中，且内容超高时回落为从顶部可滚动（无顶部裁切）；覆盖「立即获取 / 查询页操作 / 修改密码 / 发布公告 / 删除确认」等全部 Modal 与确认弹窗入口，无需逐个设 `centered`，各屏幕尺寸下均居中。配合上方 `body.ant-scrolling-effect{width:100% !important}` 共同保证弹窗开关时页面不跳动且弹窗居中。
- **移动端弹窗滚动穿透修复（2026-08-26）**：在「获取激活码」弹窗内用 Select 选使用单位并滑动单位列表时，底层 root 页面（html）也跟着滚动（scroll bleed）。根因：antd 滚动锁定只给 `<body>` 加 `ant-scrolling-effect`（overflow:hidden + 宽度收窄），但本应用真实可滚动容器是 `<html>`，仅锁 body 无法阻止触摸滑动穿透；且 Select 下拉自身不锁滚动。修复：新增 `src/utils/modalScrollLock.ts`（`initModalScrollLock()`，main.tsx 启动时调用一次），用 MutationObserver 监听 body 的 `ant-scrolling-effect` 增删（与 antd 锁计数语义一致），同步锁定/解锁 `document.documentElement.style.overflow`（主保障，兼容所有浏览器）；并补 `main.css` 的 `html:has(.ant-scrolling-effect){overflow:hidden !important}` 作为零 JS 兜底（现代浏览器）；再对 `.ant-modal-wrap/.ant-modal-body/.ant-select-dropdown .ant-select-item-options/.rc-virtual-list-holder` 加 `overscroll-behavior:contain` 隔离滚动链，越界不再带动根页面。结果：弹窗打开期间整页固定、下拉列表等内部区域正常滑动、背景不穿透。
- **⚠️ 弹窗遮罩清理「绝不 removeChild React 管理的 Portal 节点」（2026-08-26 踩坑）**：antd Modal 渲染在 `@rc-component/portal` 的 `.ant-modal-root` 中，由 React 负责卸载。`afterClose` 回调触发时该节点尚在 DOM、React 尚未卸载；若此时手动 `root.remove()`，React 后续提交阶段 `removeChild` 命中已脱离节点 → 抛 `NotFoundError` → React 19 卸载整棵树 → `#root` 变空 → index.html 的 `#root:empty` 永久转圈（表现即「关闭弹窗后页面卡在加载、无法渲染」）。`src/utils/modalScrollLock.ts` 当前设计：`initModalScrollLock()` 仅为入口兼容占位（无副作用）；`releaseModalOverlay()`（由 Modal 的 `afterClose` 与视图内 `useModalOverlayCleanup(open)` 在 open→false 后 300/700ms 兜底调用）**只做安全清理**——移除 `rc-util-locker-*` 注入样式、清 `ant-scrolling-effect` 类与 body/html 的 overflow/width，对残留的已关闭遮罩仅设 `display:none!important;pointer-events:none!important` 中和，**绝不 removeChild**。需要清理遮罩时务必只改样式、不动节点结构。
