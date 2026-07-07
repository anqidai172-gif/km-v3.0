---
name: buglearning
description: Expo React Native 闪退调试方法论 — react-native-reanimated 导致的 native crash 排查全流程
metadata: 
  node_type: memory
  type: feedback
  project: 知网 (Knowledge-Mesh)
  originSessionId: d7192b8a-012b-41be-b466-1f6371b92272
---

# Expo App 闪退调试方法论

## 问题症状
Expo Go 扫码后 App 立即闪退，Metro Bundler 编译成功无 JS 错误，无可见错误信息。

## 调试流水线（按优先级）

### 第一层：检查 Metro 日志
- Metro 输出显示 `Android Bundled Nms index.ts (N modules)` → JS 编译成功
- 崩溃发生在**原生层**而非 JS 层

### 第二层：排除法 — 创建空白模板对照
- `npx create-expo-app@latest km-test --template blank-typescript`
- 空白模板能跑 → 问题在项目依赖中
- 空白模板不能跑 → 问题在 Expo 环境本身

### 第三层：最小化项目代码
将所有页面替换为纯 `View + Text`，移除所有自定义组件、store、数据库调用，只保留根布局和路由。如果仍然崩溃 → 排除业务代码问题，锁定依赖。

### 第四层：对比依赖差异
对比空白模板和项目 `package.json`，列出额外依赖：
- `expo-router` ✓ 安全（本身不引入原生崩溃）
- `react-native-safe-area-context` ✓ 安全
- `react-native-screens` ✓ 安全
- `react-native-gesture-handler` ✓ 安全（有 JS 回退）
- **`react-native-reanimated` + `react-native-worklets`** ⚠️ 高风险

### 第五层：逐个移除嫌疑依赖
从最可疑的**原生模块**开始移除：
1. `react-native-reanimated` v4.5.0 + `react-native-worklets` v0.10.2
2. 移除后从 2155 modules → 1795 modules（减少 360）
3. 重新安装 node_modules
4. 启动后 App 正常运行 ✅

## 根因分析

**`react-native-reanimated` v4.5.0 与 Expo SDK 57 / React Native 0.86 New Architecture 存在兼容性问题。**

Reanimated v4 依赖 `react-native-worklets` 提供的 native 模块。在 Expo Go 中，worklets 的原生代码可能未正确链接或与 New Architecture 的 Turbo Module 机制冲突，导致 App 在加载原生模块时崩溃。

即使项目代码**没有直接使用 Reanimated**，但 `react-native-gesture-handler` 会在运行时检测并 import Reanimated，从而触发原生模块初始化 → 崩溃。

## 关键教训

1. **JS Bundle 编译成功 ≠ 不会崩溃** — Metro 只校验 JS 依赖解析，不校验原生模块兼容性
2. **Expo Go 对原生模块有严格限制** — 不在 Expo SDK 内置列表的原生模块（如 worklets）会崩溃
3. **默认从 package.json 移除高风险原生依赖** — 不要在 Expo Go 中使用 `react-native-reanimated`、`@shopify/react-native-skia` 等含自定义原生代码的包，除非用 development build
4. **依赖传递导入也会触发崩溃** — gesture-handler → reanimated → worklets 的链式导入
5. **对照法是最有效的调试手段** — 空白模板 vs 项目差异对比

### 第二轮排查新增教训（2026-07-07）

6. **`npx expo install --check` 检查版本兼容性** — Expo SDK 对每个原生模块都有期望版本。例如 `@react-native-async-storage/async-storage@3.1.1` 应降级到 `2.2.0` 以匹配 SDK 57。major 版本不匹配的原生模块会导致 native crash
7. **未使用的 peerDependency 也要清理** — `@react-navigation/drawer` 即使未被 import，其声明的 `react-native-reanimated` peer dependency 可能被 package manager 解析并触发原生链接
8. **nativewind + tailwindcss v4 版本冲突** — nativewind v4.x 仅支持 Tailwind CSS v3，安装 v4 会导致 Metro 配置或运行时异常。如项目使用 StyleSheet 而非 Tailwind，应彻底移除这两个包
9. **多端口残留进程导致混乱** — 多次重启 expo server 会在不同端口留下僵尸进程，`netstat -ano | grep <port>` + `taskkill` 清理后再启动
10. **最小化依赖原则** — 当前稳定运行的依赖仅 17 个（不含 devDependencies）。每增加一个依赖都应验证与 `npx expo install --check` 的兼容性

### 第三轮排查：Zustand 无限循环（Render Crash）— 2026-07-07

**症状**：App 启动后立即白屏/报错，控制台输出：
- `The result of getSnapshot should be cached to avoid an infinite loop`
- `Maximum update depth exceeded`
- 调用栈指向 Zustand 的 `useSyncExternalStore` → `useStore`

**根因**：Zustand 的 `useStore(selector)` 在每次 render 后会对比 selector 返回值（浅比较）。当 selector 直接调用 store 的**方法**（如 `s.getTodayBoard()`、`s.getItemById(id)`、`s.getItemDates()`），这些方法每次执行都返回**新的数组/对象引用**，Zustand 检测到"变化"→触发 re-render→再次调用 selector→再次返回新引用→**无限循环**。

**错误模式**：
```tsx
// ❌ 错误：getTodayBoard() 每次返回新数组
const todayBoard = useExpressionStore((s) => s.getTodayBoard());

// ❌ 错误：getItemById(id) 每次返回新对象引用（found 或 undefined）
const item = useKnowledgeStore((s) => s.getItemById(itemId));

// ❌ 错误：getItemDates() 每次返回新数组
const itemDates = useKnowledgeStore((s) => s.getItemDates());
```

**正确模式**：
```tsx
// ✅ 订阅原始数据（稳定引用）
const records = useExpressionStore((s) => s.records);

// ✅ 用 useMemo 在组件内计算派生数据
const todayBoard = useMemo(() => {
  const today = new Date().toISOString().slice(0, 10);
  return records.filter((r) =>
    r.nextReviewAt.startsWith(today) || r.createdAt.startsWith(today)
  );
}, [records]);

// ✅ 用 useMemo 做查找
const record = useMemo(() =>
  itemId ? records.find((r) => r.knowledgeItemId === itemId) : undefined,
  [records, itemId]
);
```

**判断标准**：selector 中绝对不能调用任何返回新对象/数组的方法。只允许：
- 直接读取原始属性（`.records`、`.items`、`.loading`）
- 读取稳定引用的函数（`.loadAll`、`.submitAttempt` 等方法引用，它们在 store 创建时定义，永不变）

**修复文件清单**：
| 文件 | 错误行 | 修复 |
|---|---|---|
| `app/expression/index.tsx:39` | `s.getTodayBoard()` | `useMemo(() => records.filter(...), [records])` |
| `app/expression/[itemId].tsx:39-44` | `s.getRecordByKnowledgeId(id)` + `s.getItemById(id)` | `useMemo(() => records.find(...), [records, itemId])` |
| `src/components/sidebar/SidebarContent.tsx:27` | `s.getItemDates()` | `useMemo(() => [...new Set(items.map(...))], [items])` |

---

## 闪退原因总结（三轮排查完整版）

App 闪退有两种形态，排查顺序不同：

### A. Native Crash（原生层崩溃）
App 直接闪退，Metro 编译成功无 JS 错误，无 console 输出。

**已确认的根因（按概率排序）：**
1. **`react-native-reanimated` + `react-native-worklets`** ⚠️ 最高概率 — reanimated v4 依赖 worklets 原生模块，与 Expo Go New Architecture 不兼容。gesture-handler 运行时会自动检测并加载 reanimated
2. **原生模块版本不匹配** — `@react-native-async-storage/async-storage@3.x` vs SDK 期望 `2.x`
3. **未使用的 peerDependency** — `@react-navigation/drawer` 声明的 reanimated peer dep
4. **nativewind + tailwindcss v4** — 版本冲突，nativewind 仅支持 Tailwind v3

### B. Render Crash（JS 层无限循环）
App 启动后白屏，控制台有明确的 React 错误。

**已确认的根因：**
1. **Zustand selector 返回不稳定引用** — 在 selector 中调用返回新数组/对象的方法（`getTodayBoard()` 等），导致 `useSyncExternalStore` 无限循环

---

## 关键教训（完整版）

### 原生层
1. **JS Bundle 编译成功 ≠ 不会崩溃** — Metro 只校验 JS 依赖解析，不校验原生模块兼容性
2. **Expo Go 对原生模块有严格限制** — 不在 Expo SDK 内置列表的原生模块（如 worklets）会崩溃
3. **默认从 package.json 移除高风险原生依赖** — 不要在 Expo Go 中使用 `react-native-reanimated`、`@shopify/react-native-skia` 等含自定义原生代码的包，除非用 development build
4. **依赖传递导入也会触发崩溃** — gesture-handler → reanimated → worklets 的链式导入
5. **对照法是最有效的调试手段** — 空白模板 vs 项目差异对比
6. **`npx expo install --check` 检查版本兼容性** — Expo SDK 对每个原生模块都有期望版本
7. **未使用的 peerDependency 也要清理** — 即使未被 import，peer dep 可能触发原生链接
8. **nativewind + tailwindcss v4 版本冲突** — nativewind v4.x 仅支持 Tailwind CSS v3
9. **多端口残留进程导致混乱** — `netstat -ano | grep <port>` + `taskkill` 清理
10. **最小化依赖原则** — 稳定运行仅需 17 个核心依赖

### JS 层（新增）
11. **Zustand selector 只能订阅原始数据，不能调用返回新引用的方法** — `getTodayBoard()`、`getItemById()`、`getItemDates()` 每次返回新对象/数组，在 selector 中使用会导致 `useSyncExternalStore` 无限循环。正确做法：订阅原始属性 → `useMemo` 计算派生数据
12. **区分 Native Crash 和 Render Crash** — Native Crash 无 console 输出直接闪退；Render Crash 有白屏 + React 错误信息。先看控制台再决定排查方向

---

## 快速检查清单

遇到闪退时按顺序检查：

### 第一步：判断崩溃类型
- [ ] 控制台有无 React 错误？（有 → Render Crash，跳到第三步 / 无 → Native Crash，继续第二步）

### 第二步：Native Crash 排查
- [ ] `npx expo start --clear` 清除缓存
- [ ] 检查 Metro 日志是否显示 `Bundled` 成功
- [ ] 创建空白模板验证环境
- [ ] 简化所有页面为最小 View+Text
- [ ] 检查 package.json 是否有非 expo-* 前缀的原生模块
- [ ] `npx expo install --check` 检查版本兼容性
- [ ] `rm -rf node_modules && npm install --legacy-peer-deps` 重装
- [ ] 对比空白模板 package.json 逐步移除嫌疑包
- [ ] 最终用 development build 替代 Expo Go 使用含原生模块的包

### 第三步：Render Crash 排查
- [ ] 搜索代码中 `useXxxStore(s => s.getXxx())` — 在 selector 中调用方法
- [ ] 搜索代码中 `useXxxStore(s => s.xxx())` — 任何以 `()` 结尾的 selector
- [ ] 改为订阅原始数据 + `useMemo` 计算派生数据
- [ ] `npx tsc --noEmit` 确保无类型错误
