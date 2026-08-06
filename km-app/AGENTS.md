# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# UI 设计原则

## 图标
- 所有图标必须使用项目内手绘风格的 SVG 图标（定义在 `src/components/ui/ExpressionIcons.tsx`）
- 禁止使用 Emoji（如 📋 ✅ ❌ 🎙️ 🗑️ 等），Emoji 在不同平台上渲染效果不一致，破坏手绘美学的统一性
- 如需新图标，在 `ExpressionIcons.tsx` 中以手绘 SVG 方式创建，遵循现有图标的视觉风格（不规则线条、手绘质感、`strokeLinecap="round"`）

## 配色
- 遵循 `src/theme` 中定义的色彩体系，不硬编码颜色值

## 组件
- 优先使用 `src/components/ui/` 下的现有组件
