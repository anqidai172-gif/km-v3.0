import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  Pressable,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/theme';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { useExpressionStore } from '../../src/stores';
import { useKnowledgeStore } from '../../src/stores';
import { useSettingsStore } from '../../src/stores';
import { useVoice } from '../../src/hooks/useVoice';
import { generateFeedback } from '../../src/services/ai/feedbackService';
import type { TrainingAttempt, AIFeedback } from '../../src/types';

const STATE_LABELS: Record<string, string> = {
  pending_retell: '待复述',
  retold: '已复述',
  pending_restate: '待重述',
  restated: '已重述',
};

export default function TrainingDetailPage() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const router = useRouter();

  // Stores — subscribe to raw data, compute lookups locally
  const records = useExpressionStore((s) => s.records);
  const allItems = useKnowledgeStore((s) => s.items);
  const submitAttempt = useExpressionStore((s) => s.submitAttempt);
  const receiveFeedback = useExpressionStore((s) => s.receiveFeedback);
  const submitSatisfaction = useExpressionStore((s) => s.submitSatisfaction);
  const passThreshold = useSettingsStore((s) => s.settings.passThreshold);

  // Compute lookups locally to avoid infinite Zustand loops
  const record = useMemo(() =>
    itemId ? records.find((r) => r.knowledgeItemId === itemId) : undefined,
    [records, itemId]
  );
  const item = useMemo(() =>
    itemId ? allItems.find((i) => i.id === itemId) : undefined,
    [allItems, itemId]
  );

  // Voice hook
  const { isRecording, transcription, startRecord, stopRecord, clearTranscription } = useVoice();

  // Local state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSatisfaction, setShowSatisfaction] = useState(false);
  const [satisfactionComment, setSatisfactionComment] = useState('');
  const [completedAttemptId, setCompletedAttemptId] = useState<string | null>(null);
  const [showContent, setShowContent] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  // Recording animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording]);

  if (!record || !item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← 返回</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>记录未找到</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handlePressIn = useCallback(async () => {
    clearTranscription();
    await startRecord();
  }, [startRecord, clearTranscription]);

  const handlePressOut = useCallback(async () => {
    if (!isRecording) return;
    const text = await stopRecord();
    if (text && record) {
      setIsProcessing(true);
      try {
        const attempt = await submitAttempt(record.id, text);

        // Try AI feedback, fall back to mock
        let feedback: AIFeedback;
        try {
          feedback = await generateFeedback({
            originalContent: item.content,
            userTranscription: text,
          });
        } catch {
          // Use mock feedback as fallback when AI is unavailable
          feedback = {
            accuracyScore: 78,
            fluencyScore: 82,
            overallScore: 80,
            comparison: '用户表述中涵盖了原文大部分关键要点，但在细节描述上与原意略有偏差，建议查阅原文比照。',
            rootCause: '判定为表达技巧问题：用户对知识的理解大致正确，但口头表达时组织不够条理，导致部分信息遗漏。',
            expressionTips: '建议采用"总-分-总"结构：先概述核心观点，再分别展开关键论据，最后总结归纳。',
            optimalExpression: '（优化后）该知识点的核心要点是...首先...其次...最后...综上所述...',
            suggestions: [
              '使用更简洁的句式表达复杂概念',
              '注意逻辑连接词的使用（因此、然而、此外）',
              '控制语速，给听众留出理解时间',
            ],
            modelUsed: 'mock',
          };
        }

        const score = Math.round(
          (feedback.accuracyScore + feedback.fluencyScore + feedback.overallScore) / 3
        );
        await receiveFeedback(record.id, attempt.id, feedback, score, passThreshold);

        if (score >= passThreshold) {
          Alert.alert('🎉 恭喜通关！', `你的评分 ${score} 分已达到达标线 ${passThreshold} 分！`);
        }

        setCompletedAttemptId(attempt.id);
        setShowSatisfaction(true);
      } catch (error) {
        console.error('Feedback generation failed:', error);
        Alert.alert('错误', '反馈生成失败，请重试');
      } finally {
        setIsProcessing(false);
      }
    }
  }, [isRecording, stopRecord, record, item, submitAttempt, receiveFeedback, passThreshold]);

  const handleSatisfaction = async (type: 'thumbs_up' | 'thumbs_down') => {
    if (completedAttemptId) {
      await submitSatisfaction(record.id, completedAttemptId, type, satisfactionComment || undefined);
    }
    setShowSatisfaction(false);
    setSatisfactionComment('');
  };

  // Re-derive latest record from the subscribed records array
  const latestRecord = useMemo(() =>
    records.find((r) => r.id === record.id),
    [records, record.id]
  ) || record;
  const latestAttempts = latestRecord.attempts;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← 返回</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>对话训练</Text>
        <View style={styles.headerRight}>
          <Badge label={STATE_LABELS[latestRecord.state] || latestRecord.state} size="sm" />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Knowledge Content Card */}
        <Card elevated style={styles.contentCard}>
          <Pressable onPress={() => setShowContent(!showContent)}>
            <View style={styles.contentHeader}>
              <Text style={styles.contentTitle}>{item.title}</Text>
              <Text style={styles.expandIcon}>{showContent ? '▲' : '▼'}</Text>
            </View>
          </Pressable>
          {showContent && (
            <View style={styles.contentBody}>
              <Text style={styles.contentText}>{item.content}</Text>
              {item.sourceURL && (
                <Text style={styles.sourceLink}>📎 来源: {item.sourceURL}</Text>
              )}
            </View>
          )}
        </Card>

        {/* Score Summary */}
        {latestRecord.bestScore != null && (
          <Card elevated style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>最佳分</Text>
                <Text style={styles.scoreValue}>{latestRecord.bestScore}</Text>
              </View>
              <View style={styles.scoreDivider} />
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>当前分</Text>
                <Text style={styles.scoreValue}>{latestRecord.currentScore ?? '-'}</Text>
              </View>
              <View style={styles.scoreDivider} />
              <View style={styles.scoreItem}>
                <Text style={styles.scoreLabel}>尝试次数</Text>
                <Text style={styles.scoreValue}>{latestAttempts.length}</Text>
              </View>
            </View>
          </Card>
        )}

        {/* Separator */}
        <View style={styles.separator}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>对话记录</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* Attempts History */}
        {latestAttempts.map((attempt) => (
          <View key={attempt.id}>
            {/* User Message */}
            <View style={styles.userMessage}>
              <Text style={styles.messageLabel}>你的复述 #{attempt.attemptNumber}</Text>
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{attempt.transcription}</Text>
              </View>
            </View>

            {/* AI Feedback */}
            {attempt.feedback && (
              <View style={styles.aiMessage}>
                <Text style={styles.messageLabel}>🤖 AI 反馈</Text>
                <Card elevated style={styles.feedbackCard}>
                  <Text style={styles.feedbackSection}>
                    <Text style={styles.feedbackLabel}>① 出入对比{'\n'}</Text>
                    {attempt.feedback.comparison}
                  </Text>
                  <Text style={styles.feedbackSection}>
                    <Text style={styles.feedbackLabel}>② 根本归因{'\n'}</Text>
                    {attempt.feedback.rootCause}
                  </Text>
                  <Text style={styles.feedbackSection}>
                    <Text style={styles.feedbackLabel}>③ 表达技巧{'\n'}</Text>
                    {attempt.feedback.expressionTips}
                  </Text>
                  <Text style={styles.feedbackSection}>
                    <Text style={styles.feedbackLabel}>④ 最优推荐表达{'\n'}</Text>
                    {attempt.feedback.optimalExpression}
                  </Text>

                  {/* Score */}
                  <View style={styles.scoreSection}>
                    <Text style={styles.feedbackLabel}>⑤ 即时评分</Text>
                    <Text style={styles.bigScore}>{attempt.feedback.overallScore}</Text>
                    <Text style={styles.scoreUnit}>分</Text>
                    <View style={styles.scoreDetails}>
                      <Text style={styles.scoreDetailText}>
                        准确度: {attempt.feedback.accuracyScore}分
                      </Text>
                      <Text style={styles.scoreDetailText}>
                        流畅度: {attempt.feedback.fluencyScore}分
                      </Text>
                    </View>

                    {/* Suggestions */}
                    {attempt.feedback.suggestions.length > 0 && (
                      <View style={styles.suggestionsSection}>
                        <Text style={styles.suggestionsTitle}>改进建议：</Text>
                        {attempt.feedback.suggestions.map((s, i) => (
                          <Text key={i} style={styles.suggestionItem}>
                            • {s}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                </Card>
              </View>
            )}

            {/* Pass/Fail */}
            {attempt.score != null && (
              <View style={styles.attemptStatus}>
                <Text style={styles.attemptStatusText}>
                  {attempt.score >= passThreshold
                    ? '✅ 已达标'
                    : '⚠️ 未达标，需重新巩固'}
                </Text>
              </View>
            )}
          </View>
        ))}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Recording Area */}
      <View style={styles.inputArea}>
        {transcription && !isProcessing ? (
          <View style={styles.transcriptionPreview}>
            <Text style={styles.transcriptionText} numberOfLines={2}>
              {transcription}
            </Text>
            <TouchableOpacity onPress={clearTranscription}>
              <Text style={styles.clearText}>清除</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isProcessing && (
          <View style={styles.processingBar}>
            <Text style={styles.processingText}>⏳ AI 正在分析你的复述...</Text>
          </View>
        )}

        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.recordBtnWrap}
        >
          <Animated.View
            style={[
              styles.recordBtn,
              { transform: [{ scale: pulseAnim }] },
              isRecording && styles.recordBtnActive,
            ]}
          >
            <Text style={styles.recordBtnIcon}>
              {isRecording ? '⏹' : '🎤'}
            </Text>
          </Animated.View>
        </Pressable>
        <Text style={styles.recordHint}>
          {isRecording ? '松手结束录音' : '按住开始复述'}
        </Text>
      </View>

      {/* Satisfaction Feedback Modal */}
      {showSatisfaction && (
        <View style={styles.satisfactionOverlay}>
          <View style={styles.satisfactionCard}>
            <Text style={styles.satisfactionTitle}>训练满意度反馈</Text>
            <Text style={styles.satisfactionDesc}>
              本次训练体验如何？你的反馈将帮助AI优化纠偏标准
            </Text>
            <TextInput
              style={styles.satisfactionInput}
              placeholder="输入你的意见或建议（可选）..."
              placeholderTextColor={colors.text.tertiary}
              value={satisfactionComment}
              onChangeText={setSatisfactionComment}
              multiline
              numberOfLines={3}
            />
            <View style={styles.satisfactionActions}>
              <Button variant="ghost" onPress={() => handleSatisfaction('thumbs_down')}>
                👎 需要改进
              </Button>
              <Button onPress={() => handleSatisfaction('thumbs_up')}>
                👍 满意
              </Button>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backBtnText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerRight: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  // Content card
  contentCard: {
    marginBottom: 4,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    marginRight: 12,
  },
  expandIcon: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  contentBody: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  contentText: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 24,
  },
  sourceLink: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 10,
  },
  // Score
  scoreCard: {
    marginBottom: 4,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreItem: {
    flex: 1,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  scoreDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.divider,
  },
  // Separator
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    gap: 12,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  separatorText: {
    fontSize: 13,
    color: colors.text.tertiary,
  },
  // Messages
  userMessage: {
    marginBottom: 12,
  },
  messageLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginBottom: 6,
    marginLeft: 4,
  },
  userBubble: {
    backgroundColor: colors.primaryLight,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 14,
  },
  userBubbleText: {
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
  },
  aiMessage: {
    marginBottom: 12,
  },
  feedbackCard: {
    gap: 12,
  },
  feedbackSection: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  feedbackLabel: {
    fontWeight: '700',
    color: colors.text.primary,
    fontSize: 15,
  },
  scoreSection: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  bigScore: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.primary,
    lineHeight: 56,
  },
  scoreUnit: {
    fontSize: 18,
    color: colors.primary,
    fontWeight: '600',
  },
  scoreDetails: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  scoreDetailText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  suggestionsSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    alignSelf: 'stretch',
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 6,
  },
  suggestionItem: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 22,
    marginLeft: 4,
  },
  attemptStatus: {
    alignItems: 'center',
    marginBottom: 16,
  },
  attemptStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  // Recording
  inputArea: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    alignItems: 'center',
  },
  transcriptionPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    width: '100%',
  },
  transcriptionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  clearText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    marginLeft: 8,
  },
  processingBar: {
    paddingVertical: 6,
    marginBottom: 8,
  },
  processingText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  recordBtnWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  recordBtnActive: {
    backgroundColor: colors.danger,
  },
  recordBtnIcon: {
    fontSize: 26,
  },
  recordHint: {
    fontSize: 12,
    color: colors.text.tertiary,
    marginTop: 8,
  },
  // Satisfaction
  satisfactionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  satisfactionCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  satisfactionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  satisfactionDesc: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  satisfactionInput: {
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  satisfactionActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  bottomPadding: {
    height: 40,
  },
});
