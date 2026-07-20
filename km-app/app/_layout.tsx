import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TabBar } from '../src/components/ui/TabBar';
import { colors } from '../src/theme';
import { useKnowledgeStore } from '../src/stores';
import { useExpressionStore } from '../src/stores';
import { useSettingsStore } from '../src/stores';

/** 首次启动时创建演示知识数据，用于展示首页轮播 */
async function seedDemoDataIfEmpty() {
  const knItems = useKnowledgeStore.getState().items;
  if (knItems.length > 0) return;

  const demoItems = [
    { title: '费曼学习法：用大白话解释复杂概念', content: '费曼学习法的核心在于"以教代学"。选择一个概念，尝试用最简单的语言向一个完全不懂的人解释它。如果卡住了，回到原始材料重新学习；如果用了专业术语，必须替换成日常用语。', preview: '用教别人的方式来检验自己的理解——费曼学习法的核心。', catId: 'cat_tech' },
    { title: '认知心理学中的间隔重复原理', content: '艾宾浩斯遗忘曲线表明：信息获取后遗忘立即开始。间隔重复通过在遗忘临界点进行复习来强化记忆——每次成功回忆后，下次复习间隔加倍。', preview: '在最容易遗忘的时刻进行复习——间隔重复如何对抗遗忘曲线。', catId: 'cat_science' },
    { title: '知识内化的三个层次：记忆、理解、应用', content: '第一层是表层记忆。第二层是深度理解——能用自己的话解释并连接到已有知识。第三层是自动化应用——无需刻意思考就能在新情境中灵活运用。', preview: '从复述到理解再到自动化——知识如何从信息变成能力。', catId: 'cat_philosophy' },
  ];

  for (let i = 0; i < demoItems.length; i++) {
    const di = demoItems[i];
    const item = await useKnowledgeStore.getState().addItem({
      categoryId: di.catId,
      title: di.title,
      content: di.content,
      contentPreview: di.preview,
      sourceType: 'text',
      tags: ['演示'],
      aiSummary: di.preview,
      aiClassificationScore: 75 + i * 5,
      status: 'confirmed',
    });

    // 创建训练记录
    try {
      const record = await useExpressionStore.getState().createRecord(item.id);
      // 为后两条创建模拟训练数据 (分数)
      if (i > 0) {
        const store = useExpressionStore.getState();
        const recent = store.records.find(r => r.id === record.id);
        if (recent) {
          const attempt = await store.submitAttempt(recent.id, `[演示] 这是关于"${di.title}"的复述练习内容。`);
          const score = i === 1 ? 85 : 72;
          await store.receiveFeedback(recent.id, attempt.id, {
            accuracyScore: score, fluencyScore: score, overallScore: score,
            comparison: '演示反馈：表述清晰', rootCause: '演示数据',
            expressionTips: '演示数据', optimalExpression: '演示数据',
            suggestions: ['演示建议'], modelUsed: 'demo',
          }, score, 60);
        }
      }
    } catch { /* 训练记录创建失败不影响知识条目 */ }
  }
}

export default function RootLayout() {
  useEffect(() => {
    const init = async () => {
      await useKnowledgeStore.getState().loadAll();
      await useKnowledgeStore.getState().loadCategories();
      await useSettingsStore.getState().load();
      await useExpressionStore.getState().loadTodayBoard();
      // 创建演示数据
      await seedDemoDataIfEmpty();
    };
    init();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="home" />
          <Stack.Screen name="expression" />
          <Stack.Screen name="input" />
          <Stack.Screen name="mesh" />
          <Stack.Screen name="settings" />
        </Stack>
      </View>
      <TabBar />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
});
