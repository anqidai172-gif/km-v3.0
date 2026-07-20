---
name: expo-go-crash-transitive-deps
description: Expo Go 闪退修复全记录 — 传递依赖原生模块崩溃 + 路由冲突 + Zustand 防无限循环
metadata:
  type: project
  project: 知网 (Knowledge-Mesh)
  date: 2026-07-18
  related: [[buglearning]]
---

# Expo Go 闪退修复全记录（2026-07-18）

## 症状

在 Expo Go 中输入 `exp://<ip>:8082` 后 App 立即闪退，无白屏、无 React 错误信息、Metro Bundler 显示编译成功。

## 排查过程

### 第一层：检查 Metro 日志
- `curl http://localhost:8082/status` → `packager-status:running`
- `curl http://localhost:8082/index.ts.bundle?...` → Bundle 编译成功，末尾正常输出 `__r(0)`
- 结论：JS 编译无问题 → **崩溃发生在原生层**

### 第二层：检查路由结构
- `find app/ -type f` → 发现 `app/(tabs)/` 目录，内含四个空子目录（`expression/`, `input/`, `mesh/`, `settings/`）
- `(tabs)/` 是旧路由结构的残留，没有 `_layout.tsx`，与根目录同名路由冲突
- **修复**：`rm -rf app/(tabs)/`

### 第三层：检查路由完整性
- `app/knowledge/_layout.tsx` 只注册了 `[itemId]` 动态路由，没有 `index` 默认页
- Expo Router 解析到 `/knowledge` 时找不到初始屏幕 → 可能崩溃
- **修复**：创建 `app/knowledge/index.tsx`（Redirect 到 /expression），更新 `_layout.tsx` 注册 index

### 第四层：检查 Store 初始化
- `app/_layout.tsx` 的 `useEffect` 中直接调用 `loadAll()` / `loadCategories()` / `load()` 无错误处理
- 数据库初始化失败时 → 未捕获的 Promise rejection
- **修复**：包裹 try/catch，合并为 `Promise.all([...])`

### 第五层：最小化代码验证（关键步骤）
- 将所有页面替换为纯 `View + Text`，移除：
  - 所有 Store 导入
  - TabBar、GestureHandlerRootView、StatusBar
  - 数据库调用
  - AI 服务调用
- 重启 Expo 服务器 → **依旧闪退**
- 结论：问题不在业务代码 → **100% 确定是原生依赖问题**

### 第六层：追踪原生依赖链
- 从 package.json 看，没有 `react-native-reanimated` 或 `react-native-worklets`
- 但 `npm ls react-native-reanimated` 显示：

```
km-app@1.0.0
└── expo-router@57.0.4
    ├── react-native-drawer-layout@4.2.7
    │   └── react-native-reanimated@4.5.2
    └── react-native-reanimated@4.5.2
        └── react-native-worklets@0.10.2
```

- 同时 `expo@57.0.4 → expo-modules-core@57.0.3 → react-native-worklets@0.10.2`
- **根因**：expo-router v57 的传递依赖重新引入了 reanimated + worklets

### 第七层：利用 Gesture-Handler 的降级机制
- 分析 `node_modules/react-native-gesture-handler/lib/commonjs/handlers/gestures/reanimatedWrapper.js`：

```js
try {
  exports.Reanimated = Reanimated = require('react-native-reanimated');
} catch (e) {
  exports.Reanimated = Reanimated = undefined; // ← 安全降级
}
if (!Reanimated?.useSharedValue) {
  exports.Reanimated = Reanimated = undefined; // ← 二次检查
}
```

- 当 reanimated **存在**时：`require()` 成功 → worklets 原生模块加载 → **Native Crash**
- 当 reanimated **不存在**时：`require()` 抛异常 → 降级到纯 JS 实现 → **正常工作**

### 第八层：验证假设
- `rm -rf node_modules/react-native-reanimated node_modules/react-native-worklets`
- 重启 Expo → Bundle 编译成功 → **App 正常打开，显示 "KM v3.0 - 知网"**
- 假设验证通过 ✅

## 永久修复方案

### 方案设计

创建**不含原生模块的 stub 包**，利用 npm `postinstall` 脚本在每次安装后自动替换。

stub 的关键设计：
- `react-native-reanimated` stub：导出常见 API 的 noop 实现，但 `useSharedValue: undefined` 故意触发 gesture-handler 的 JS 降级路径
- `react-native-worklets` stub：空模块 `module.exports = {}`

### 文件清单

| 文件 | 用途 |
|------|------|
| `stubs/react-native-reanimated/package.json` | stub 包声明 |
| `stubs/react-native-reanimated/index.js` | 最小 JS API（`useSharedValue: undefined`）|
| `stubs/react-native-worklets/package.json` | stub 包声明 |
| `stubs/react-native-worklets/index.js` | 空模块 |
| `scripts/patch-reanimated.js` | postinstall：用 stub 替换真实包 |
| `package.json` → `"postinstall": "node scripts/patch-reanimated.js"` | 自动执行 |

### 工作原理

```
npm install
  → 安装 expo-router 及其传递依赖（含真实 reanimated/worklets）
  → postinstall 钩子触发
  → scripts/patch-reanimated.js 执行
  → 删除 node_modules/react-native-reanimated/
  → 复制 stubs/react-native-reanimated/ → node_modules/react-native-reanimated/
  → 删除 node_modules/react-native-worklets/
  → 复制 stubs/react-native-worklets/ → node_modules/react-native-worklets/
  → ✅ 完成
```

不修改 package-lock.json，不破坏依赖树。

## 闪退原因分类（更新版）

### A. Native Crash（原生层崩溃）
App 直接闪退，Metro 编译成功无 JS 错误。

| 优先级 | 原因 | 检测方法 |
|--------|------|----------|
| ⚠️ 最高 | `react-native-reanimated` + `react-native-worklets` 传递依赖 | `npm ls react-native-reanimated` |
| 高 | 原生模块版本不匹配 | `npx expo install --check` |
| 中 | 未使用的 peerDependency 触发原生链接 | 检查 package.json 的 peerDeps |
| 中 | nativewind + tailwindcss v4 冲突 | 检查依赖列表 |
| 低 | 路由结构冲突（目录残留） | `find app/ -type d -empty` |

### B. Render Crash（JS 层无限循环）
App 启动后白屏，控制台有 React 错误。

| 优先级 | 原因 | 检测方法 |
|--------|------|----------|
| ⚠️ 最高 | Zustand selector 中调用返回新引用的方法 | grep `useXxxStore(s => s.getXxx())` |
| 高 | 路由缺少 index 默认页 | 检查每个路由目录是否有 index.tsx |
| 中 | 数据库初始化未捕获异常 | 检查 useEffect 的 try/catch |

## 调试流水线（完整版）

```
1. Metro 日志 → Bundle 编译成功？
   ├─ 失败 → JS 语法/导入错误 → npx tsc --noEmit
   └─ 成功 → 继续 ↓

2. 最小化验证 → 所有页面换为 View+Text，移除所有 imports
   ├─ 能打开 → 业务代码问题 ↓
   │   ├─ 检查 Zustand selector 模式
   │   ├─ 检查路由结构完整性
   │   └─ 检查 useEffect 错误处理
   └─ 依旧闪退 → 原生依赖问题 ↓

3. npm ls 追踪依赖 → 找到原生模块来源
   ├─ npm ls react-native-reanimated
   ├─ npm ls react-native-worklets
   └─ npx expo install --check

4. 原生模块修复
   ├─ 从 package.json 移除（直接依赖）
   ├─ 创建 stub + postinstall（传递依赖）
   └─ 最终方案：development build（需要原生代码时）

5. 永久方案验证
   ├─ npm install → postinstall 自动打补丁
   ├─ npx expo start --clear 清除缓存
   └─ Expo Go 测试确认
```

## 关键教训

1. **JS Bundle 编译成功 ≠ 不会崩溃** — Metro 只校验 JS 依赖解析，不校验原生模块兼容性
2. **传递依赖也能导致 native crash** — `npm ls <pkg>` 追踪依赖链
3. **最小化验证是最有效的诊断手段** — 排除业务代码 vs 依赖问题
4. **Gesture-handler 有内置降级机制** — 利用 `useSharedValue: undefined` 触发 JS fallback
5. **Postinstall stub 替换是可靠的永久方案** — 不修改 lock file，每次 install 自动生效
6. **Expo Go 对原生模块有严格限制** — 不在 Expo SDK 内置列表的原生模块会崩溃
7. **路由目录残留会引发崩溃** — 空目录 + 无 _layout.tsx = 路由冲突
8. **Zustand selector 只能订阅原始属性** — 不能调用返回新引用的方法
