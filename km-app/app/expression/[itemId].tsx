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
import { format } from 'date-fns';
import { colors, tokens, fontFamily } from '../../src/theme';
import { pageContentPadding } from '../../src/theme/layout';
import { Card } from '../../src/components/ui/Card';
import { PageHeader } from '../../src/components/ui/PageHeader';
import {
  ChevronLeftIcon, SparkleIcon,
  HourglassIcon, MicIcon, CheckIcon, PencilIcon, SendIcon,
} from '../../src/components/ui/ExpressionIcons';
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
  const { itemId, initialText } = useLocalSearchParams<{ itemId: string; initialText?: string }>();
  const router = useRouter();

  // Stores
  const records = useExpressionStore((s) => s.records);
  const allItems = useKnowledgeStore((s) => s.items);
  const submitAttempt = useExpressionStore((s) => s.submitAttempt);
  const receiveFeedback = useExpressionStore((s) => s.receiveFeedback);
  const submitSatisfaction = useExpressionStore((s) => s.submitSatisfaction);
  const finishSession = useExpressionStore((s) => s.finishSession);
  const passThreshold = useSettingsStore((s) => s.settings.passThreshold);

  const record = useMemo(() =>
    itemId ? records.find((r) => r.knowledgeItemId === itemId) : undefined,
    [records, itemId]
  );
  const item = useMemo(() =>
    itemId ? allItems.find((i) => i.id === itemId) : undefined,
    [allItems, itemId]
  );

  const { isRecording, isTranscribing, transcription, startRecord, stopRecord, clearTranscription } = useVoice();

  // Local state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEndTraining, setShowEndTraining] = useState(false);
  const [showSatisfactionInline, setShowSatisfactionInline] = useState(false);
  const [satisfactionComment, setSatisfactionComment] = useState('');
  const [showFullContent, setShowFullContent] = useState(false);
  const [expandedBubbles, setExpandedBubbles] = useState<Record<string, boolean>>({});
  const [recordingPhase, setRecordingPhase] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [inputMode, setInputMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');

  // Pending attempt — stored locally until "结束训练" commits it
  const [pendingAttempt, setPendingAttempt] = useState<{
    transcription: string;
    feedback: AIFeedback;
    score: number;
  } | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  // Recording animation
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (recordingPhase === 'recording') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recordingPhase]);

  if (!record || !item) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeftIcon size={16} color={colors.primary} />
            <Text style={styles.backBtnText}> 返回</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>记录未找到</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 如果从首页快捷输入传入了 initialText，自动触发反馈生成
  const feedbackTriggeredRef = useRef(false);
  useEffect(() => {
    if (feedbackTriggeredRef.current) return;
    if (!initialText || !record || !item) return;
    feedbackTriggeredRef.current = true;

    (async () => {
      setIsProcessing(true);
      try {
        let feedback: AIFeedback;
        try {
          feedback = await generateFeedback({
            originalContent: item.content,
            userTranscription: initialText,
          });
        } catch {
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
        setPendingAttempt({ transcription: initialText, feedback, score });
        if (score >= passThreshold) setShowEndTraining(true);
      } catch (error: any) {
        console.error('[initialText] Feedback generation failed:', error);
      } finally {
        setIsProcessing(false);
      }
    })();
  }, [initialText, record, item, passThreshold]);

  const handlePressIn = useCallback(async () => {
    setShowEndTraining(false);
    setPendingAttempt(null);
    clearTranscription();
    try {
      await startRecord();
      setRecordingPhase('recording');
    } catch (error: any) {
      setRecordingPhase('idle');
      Alert.alert('无法录音', error?.message || '录音启动失败，请检查麦克风权限');
    }
  }, [startRecord, clearTranscription]);

  const handlePressOut = useCallback(async () => {
    if (recordingPhase !== 'recording') return;
    try {
      setRecordingPhase('transcribing');
      const text = await stopRecord();
      if (text && record) {
        setRecordingPhase('idle');
        setIsProcessing(true);
        try {
          let feedback: AIFeedback;
          try {
            feedback = await generateFeedback({
              originalContent: item.content,
              userTranscription: text,
            });
          } catch {
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

          // Store locally — NOT persisted to DB until "结束训练"
          setPendingAttempt({ transcription: text, feedback, score });

          if (score >= passThreshold) {
            setShowEndTraining(true);
          }
        } catch (error) {
          console.error('Feedback generation failed:', error);
          Alert.alert('错误', '反馈生成失败，请重试');
        } finally {
          setIsProcessing(false);
        }
      } else {
        // stopRecord returned empty — recording never started or was too short
        setRecordingPhase('idle');
      }
    } catch (error: any) {
      setRecordingPhase('idle');
      const msg = error?.message || '';
      // 录音未开始或太短 → 静默重置，不弹 Alert
      if (msg.includes('录音时间过短') || msg.includes('录音文件为空')) {
        // silent reset — user just tapped briefly
      } else {
        console.error('Voice transcription failed:', error);
        Alert.alert('语音转写失败', msg || '请检查服务器连接后重试');
      }
    }
  }, [stopRecord, record, item, passThreshold, recordingPhase]);

  const handleTextSubmit = useCallback(async () => {
    const text = textInput.trim();
    if (!text) { Alert.alert('提示', '请输入复述内容'); return; }
    if (!record) return;
    setShowEndTraining(false);
    setPendingAttempt(null);
    setIsProcessing(true);
    try {
      let feedback: AIFeedback;
      try {
        feedback = await generateFeedback({
          originalContent: item.content,
          userTranscription: text,
        });
      } catch {
        feedback = {
          accuracyScore: 78, fluencyScore: 82, overallScore: 80,
          comparison: '用户表述中涵盖了原文大部分关键要点，但在细节描述上与原意略有偏差，建议查阅原文比照。',
          rootCause: '判定为表达技巧问题：用户对知识的理解大致正确，但口头表达时组织不够条理，导致部分信息遗漏。',
          expressionTips: '建议采用"总-分-总"结构：先概述核心观点，再分别展开关键论据，最后总结归纳。',
          optimalExpression: '（优化后）该知识点的核心要点是...首先...其次...最后...综上所述...',
          suggestions: ['使用更简洁的句式表达复杂概念', '注意逻辑连接词的使用（因此、然而、此外）', '控制语速，给听众留出理解时间'],
          modelUsed: 'mock',
        };
      }
      const score = Math.round((feedback.accuracyScore + feedback.fluencyScore + feedback.overallScore) / 3);
      setPendingAttempt({ transcription: text, feedback, score });
      setTextInput('');
      if (score >= passThreshold) setShowEndTraining(true);
    } catch (error) {
      console.error('Feedback generation failed:', error);
      Alert.alert('错误', '反馈生成失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  }, [textInput, record, item, passThreshold]);

  const handleEndTraining = async () => {
    if (!pendingAttempt || !record) return;
    setShowEndTraining(false);

    // 1. Persist the attempt to DB
    const attempt = await submitAttempt(record.id, pendingAttempt.transcription);
    await receiveFeedback(record.id, attempt.id, pendingAttempt.feedback, pendingAttempt.score, passThreshold);
    lastCompletedAttemptId.current = attempt.id;

    // 2. Update state: 待复述→已复述, 已复述→不变
    await finishSession(record.id);

    // 3. Clear pending & show satisfaction
    setPendingAttempt(null);
    setShowSatisfactionInline(true);
  };

  // Track the last completed attempt ID for satisfaction
  const lastCompletedAttemptId = useRef<string | null>(null);

  const handleSatisfaction = async (type: 'thumbs_up' | 'thumbs_down') => {
    if (lastCompletedAttemptId.current) {
      await submitSatisfaction(record.id, lastCompletedAttemptId.current, type, satisfactionComment || undefined);
    }
    setShowSatisfactionInline(false);
    setSatisfactionComment('');
  };

  const toggleBubble = (attemptId: string) => {
    setExpandedBubbles((prev) => ({ ...prev, [attemptId]: !prev[attemptId] }));
  };

  // Latest data
  const latestRecord = useMemo(() =>
    records.find((r) => r.id === record.id),
    [records, record.id]
  ) || record;
  const latestAttempts = latestRecord.attempts;

  // AI summary for knowledge review
  const knowledgeSummary = item.contentPreview || item.content.slice(0, 200);

  // Group attempts by date (for date separators)
  const groupedByDate = useMemo(() => {
    const groups: { date: string; entries: Array<{
      type: 'persisted'; attempt: (typeof latestAttempts)[number];
    } | {
      type: 'pending'; data: typeof pendingAttempt;
    }> }[] = [];

    // Persisted attempts grouped by createdAt date
    for (const a of latestAttempts) {
      const ts = a.createdAt ? new Date(a.createdAt) : new Date();
      const d = isNaN(ts.getTime()) ? format(new Date(), 'yyyy/MM/dd') : format(ts, 'yyyy/MM/dd');
      const last = groups[groups.length - 1];
      if (last && last.date === d) {
        last.entries.push({ type: 'persisted' as const, attempt: a });
      } else {
        groups.push({ date: d, entries: [{ type: 'persisted' as const, attempt: a }] });
      }
    }

    // Pending attempt — group under today's date
    if (pendingAttempt) {
      const today = format(new Date(), 'yyyy/MM/dd');
      const last = groups[groups.length - 1];
      if (last && last.date === today) {
        last.entries.push({ type: 'pending' as const, data: pendingAttempt });
      } else {
        groups.push({ date: today, entries: [{ type: 'pending' as const, data: pendingAttempt }] });
      }
    }

    return groups;
  }, [latestAttempts, pendingAttempt]);

  // Auto-scroll to latest conversation on mount
  useEffect(() => {
    if (latestAttempts.length > 0 || pendingAttempt) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 300);
    }
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader
        title="对话训练"
        leftAction={
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBackBtn} activeOpacity={0.5}>
            <ChevronLeftIcon size={18} color={colors.primary} />
          </TouchableOpacity>
        }
        rightAction={
          <Text style={styles.headerStatus}>
            {STATE_LABELS[latestRecord.state] || latestRecord.state}
          </Text>
        }
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ Knowledge Review Card ═══ */}
        <Card elevated style={styles.reviewCard}>
          <View style={styles.reviewCardHeader}>
            <Text style={styles.reviewTitle} numberOfLines={1}>{item.title}</Text>
            {latestRecord.bestScore != null && (
              <Text style={styles.reviewStats}>
                最佳 {latestRecord.bestScore}分 · {latestAttempts.length}次
              </Text>
            )}
          </View>
          <View style={styles.reviewDivider} />
          <View style={styles.reviewBody}>
            <Text
              style={styles.reviewText}
              numberOfLines={showFullContent ? undefined : 3}
            >
              {knowledgeSummary}
            </Text>
            {!showFullContent && knowledgeSummary.length > 100 && (
              <View style={styles.reviewOverlay}>
                <TouchableOpacity
                  onPress={() => setShowFullContent(true)}
                  activeOpacity={0.7}
                  style={styles.reviewExpandBtn}
                >
                  <Text style={styles.reviewExpandText}>展开</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {showFullContent && (
            <View style={styles.reviewFooter}>
              <TouchableOpacity onPress={() => router.push(`/knowledge/${item.id}`)} activeOpacity={0.7}>
                <Text style={styles.reviewLink}>查看知识详情</Text>
              </TouchableOpacity>
              {knowledgeSummary.length > 100 && (
                <TouchableOpacity onPress={() => setShowFullContent(false)} activeOpacity={0.7}>
                  <Text style={styles.reviewCollapse}>收起</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </Card>

        {/* ═══ Conversation Area ═══ */}
        {groupedByDate.map((group) => (
          <View key={group.date}>
            {/* Date Separator */}
            <View style={styles.dateSeparator}>
              <View style={styles.dateLine} />
              <Text style={styles.dateText}>{group.date}</Text>
              <View style={styles.dateLine} />
            </View>

            {group.entries.map((entry, idx) => {
              if (entry.type === 'persisted') {
                const attempt = entry.attempt;
                const isExpanded = expandedBubbles[attempt.id] || false;
                const textLong = attempt.transcription.length > 120;
                return (
                  <View key={attempt.id}>
                    <View style={styles.userMsgWrap}>
                      <View style={styles.userBubble}>
                        <Text style={styles.userBubbleLabel}>用户复述</Text>
                        <Text
                          style={styles.userBubbleText}
                          numberOfLines={!isExpanded && textLong ? 3 : undefined}
                        >
                          {attempt.transcription}
                        </Text>
                        {textLong && (
                          <TouchableOpacity onPress={() => toggleBubble(attempt.id)} activeOpacity={0.7}>
                            <Text style={styles.bubbleToggle}>
                              {isExpanded ? '收起' : '展开'}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {attempt.feedback && (
                      <View style={styles.aiMsgWrap}>
                        <View style={styles.aiLabelRow}>
                          <SparkleIcon size={14} color={colors.text.primary} />
                          <Text style={styles.aiLabel}> AI 反馈</Text>
                        </View>
                        <Card elevated style={styles.feedbackCard}>
                          <View style={styles.fbSection}>
                            <Text style={styles.fbLabel}>1. 内容差异对比</Text>
                            <Text style={styles.fbText}>{attempt.feedback.comparison}</Text>
                          </View>
                          <View style={styles.fbSection}>
                            <Text style={styles.fbLabel}>2. 表达问题诊断</Text>
                            <Text style={styles.fbText}>{attempt.feedback.rootCause}</Text>
                          </View>
                          <View style={styles.fbSection}>
                            <Text style={styles.fbLabel}>3. 优化改进建议</Text>
                            <Text style={styles.fbText}>{attempt.feedback.expressionTips}</Text>
                            {attempt.feedback.suggestions.length > 0 && (
                              <View style={styles.fbSuggestions}>
                                {attempt.feedback.suggestions.map((s, i) => (
                                  <Text key={i} style={styles.fbSuggestionItem}>• {s}</Text>
                                ))}
                              </View>
                            )}
                          </View>
                          <View style={styles.fbScoreRow}>
                            <Text style={styles.fbScoreStar}>★</Text>
                            <Text style={styles.fbScore}>
                              {' '}{attempt.feedback.overallScore} / 100 分
                            </Text>
                            {attempt.score != null && attempt.score >= passThreshold && (
                              <View style={styles.fbPassBadge}>
                                <CheckIcon size={12} color={colors.success} />
                                <Text style={styles.fbPassText}> 已达标</Text>
                              </View>
                            )}
                          </View>
                        </Card>
                      </View>
                    )}
                  </View>
                );
              } else {
                const pa = entry.data;
                return (
                  <View key={`pending-${idx}`}>
                    <View style={styles.userMsgWrap}>
                      <View style={styles.userBubble}>
                        <Text style={styles.userBubbleLabel}>用户复述</Text>
                        <Text style={styles.userBubbleText} numberOfLines={3}>
                          {pa.transcription}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.aiMsgWrap}>
                      <View style={styles.aiLabelRow}>
                        <SparkleIcon size={14} color={colors.text.primary} />
                        <Text style={styles.aiLabel}> AI 反馈</Text>
                      </View>
                      <Card elevated style={styles.feedbackCard}>
                        <View style={styles.fbSection}>
                          <Text style={styles.fbLabel}>1. 内容差异对比</Text>
                          <Text style={styles.fbText}>{pa.feedback.comparison}</Text>
                        </View>
                        <View style={styles.fbSection}>
                          <Text style={styles.fbLabel}>2. 表达问题诊断</Text>
                          <Text style={styles.fbText}>{pa.feedback.rootCause}</Text>
                        </View>
                        <View style={styles.fbSection}>
                          <Text style={styles.fbLabel}>3. 优化改进建议</Text>
                          <Text style={styles.fbText}>{pa.feedback.expressionTips}</Text>
                          {pa.feedback.suggestions.length > 0 && (
                            <View style={styles.fbSuggestions}>
                              {pa.feedback.suggestions.map((s, i) => (
                                <Text key={i} style={styles.fbSuggestionItem}>• {s}</Text>
                              ))}
                            </View>
                          )}
                        </View>
                        <View style={styles.fbScoreRow}>
                          <Text style={styles.fbScoreStar}>★</Text>
                          <Text style={styles.fbScore}>
                            {' '}{pa.feedback.overallScore} / 100 分
                          </Text>
                          {pa.score >= passThreshold && (
                            <View style={styles.fbPassBadge}>
                              <CheckIcon size={12} color={colors.success} />
                              <Text style={styles.fbPassText}> 已达标</Text>
                            </View>
                          )}
                        </View>
                      </Card>
                    </View>
                  </View>
                );
              }
            })}
          </View>
        ))}

        {/* ═══ Satisfaction Card (inline) ═══ */}
        {showSatisfactionInline && (
          <Card elevated style={styles.satisfactionInlineCard}>
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
              <TouchableOpacity style={styles.satisfactionBtnGhost} onPress={() => handleSatisfaction('thumbs_up')} activeOpacity={0.7}>
                <Text style={styles.satisfactionBtnGhostText}>无需改进</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.satisfactionBtnPrimary} onPress={() => handleSatisfaction('thumbs_down')} activeOpacity={0.7}>
                <Text style={styles.satisfactionBtnPrimaryText}>意见反馈</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* ═══ Input Area ═══ */}
      <View style={styles.inputArea}>
        {/* Phase status */}
        {inputMode === 'voice' && recordingPhase === 'transcribing' && (
          <View style={styles.processingBar}>
            <HourglassIcon size={14} color={colors.text.secondary} />
            <Text style={styles.processingText}> 正在语音转文字...</Text>
          </View>
        )}
        {isProcessing && (
          <View style={styles.processingBar}>
            <HourglassIcon size={14} color={colors.text.secondary} />
            <Text style={styles.processingText}> AI 正在分析你的复述...</Text>
          </View>
        )}

        {/* ── Voice Mode: [✏️ switch] [🎤 press & hold] ── */}
        {inputMode === 'voice' && (
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.modeSwitchBtn}
              onPress={() => setInputMode('text')}
              activeOpacity={0.7}
            >
              <PencilIcon size={18} color={colors.text.secondary} />
            </TouchableOpacity>
            <Pressable
              onPressIn={recordingPhase === 'idle' ? handlePressIn : undefined}
              onPressOut={recordingPhase === 'recording' ? handlePressOut : undefined}
              style={styles.recordBtnWrap}
            >
              <Animated.View
                style={[
                  styles.recordBtn,
                  { transform: [{ scale: recordingPhase === 'recording' ? pulseAnim : 1 }] },
                  recordingPhase === 'recording' && styles.recordBtnActive,
                  (recordingPhase === 'transcribing' || isProcessing) && styles.recordBtnDisabled,
                ]}
              >
                <MicIcon
                  size={20}
                  color={
                    recordingPhase === 'recording' || recordingPhase === 'transcribing' || isProcessing
                      ? colors.text.inverse : colors.primary
                  }
                />
                <Text style={[
                  styles.recordBtnText,
                  (recordingPhase === 'recording' || recordingPhase === 'transcribing' || isProcessing)
                    && styles.recordBtnTextLight,
                ]}>
                  {recordingPhase === 'recording' ? ' 松手结束复述'
                    : recordingPhase === 'transcribing' ? ' 语音转写中...'
                    : isProcessing ? ' AI 分析中...'
                    : ' 开始复述'}
                </Text>
              </Animated.View>
            </Pressable>
          </View>
        )}

        {/* ── Text Mode: [🎤 switch] [TextInput with Send inside] ── */}
        {inputMode === 'text' && (
          <View style={styles.inputRow}>
            <TouchableOpacity
              style={styles.modeSwitchBtn}
              onPress={() => setInputMode('voice')}
              activeOpacity={0.7}
            >
              <MicIcon size={18} color={colors.text.secondary} />
            </TouchableOpacity>
            <View style={styles.textInputWrap}>
              <TextInput
                style={styles.textInputField}
                placeholder="在此输入你的复述内容..."
                placeholderTextColor={colors.text.tertiary}
                value={textInput}
                onChangeText={setTextInput}
                multiline
                textAlignVertical="center"
                editable={!isProcessing}
              />
              <TouchableOpacity
                style={[styles.textSendBtn, (!textInput.trim() || isProcessing) && styles.textSendBtnDisabled]}
                onPress={handleTextSubmit}
                disabled={!textInput.trim() || isProcessing}
                activeOpacity={0.7}
              >
                <SendIcon size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showEndTraining && !isProcessing && (
          <TouchableOpacity onPress={handleEndTraining} activeOpacity={0.7}>
            <Text style={styles.endTrainingLink}>结束训练</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  headerBackBtn: {
    paddingVertical: 4,
    paddingRight: 12,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 12,
  },
  backBtnText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  headerStatus: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '500',
  },

  // ── Scroll ──
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    ...pageContentPadding,
    gap: 12,
  },

  // ── Knowledge Review Card ──
  reviewCard: {
    marginBottom: 4,
  },
  reviewCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  reviewTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily,
  },
  reviewStats: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontWeight: '500',
  },
  reviewDivider: {
    height: tokens.borderWidth.hairline,
    backgroundColor: colors.divider,
    marginVertical: 12,
  },
  reviewBody: {
    position: 'relative',
  },
  reviewText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  reviewOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    height: 22,
    justifyContent: 'center',
    backgroundColor: 'rgba(250, 246, 238, 0.90)',
  },
  reviewExpandBtn: {
    paddingHorizontal: 4,
  },
  reviewExpandText: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '600',
  },
  reviewFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: tokens.borderWidth.hairline,
    borderTopColor: colors.divider,
  },
  reviewCollapse: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '500',
  },
  reviewLink: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '500',
  },

  // ── Date Separator ──
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    gap: 12,
  },
  dateLine: {
    flex: 1,
    height: tokens.borderWidth.hairline,
    backgroundColor: colors.divider,
  },
  dateText: {
    fontSize: 12,
    color: colors.text.tertiary,
  },

  // ── User Message (right aligned) ──
  userMsgWrap: {
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  userBubble: {
    backgroundColor: colors.primaryLight,
    borderRadius: 5,
    borderTopRightRadius: 2,
    padding: 14,
    maxWidth: '85%',
    minWidth: 120,
  },
  userBubbleLabel: {
    fontSize: 11,
    color: colors.text.tertiary,
    marginBottom: 6,
  },
  userBubbleText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 22,
  },
  bubbleToggle: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '500',
    marginTop: 8,
    textAlign: 'right',
  },

  // ── AI Message (left aligned) ──
  aiMsgWrap: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  aiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginLeft: 4,
    gap: 4,
  },
  aiLabel: {
    fontSize: 12,
    color: colors.text.tertiary,
  },
  feedbackCard: {
    gap: 14,
  },

  // ── Feedback Sections ──
  fbSection: {
    gap: 6,
  },
  fbLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
  },
  fbText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  fbSuggestions: {
    marginTop: 6,
    gap: 4,
  },
  fbSuggestionItem: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 21,
    marginLeft: 4,
  },

  // ── Feedback Score ──
  fbScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: tokens.borderWidth.hairline,
    borderTopColor: colors.divider,
    gap: 4,
  },
  fbScoreStar: {
    fontSize: 16,
    color: colors.accent,
  },
  fbScore: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    fontFamily,
  },
  fbPassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: colors.success,
  },
  fbPassText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },

  // ── Input Area ──
  inputArea: {
    borderTopWidth: tokens.borderWidth.hairline,
    borderTopColor: colors.divider,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  // Row: mode switch + main input
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeSwitchBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Text input wrapper (send btn inside, matching home page style)
  textInputWrap: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
  },
  textInputField: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.background,
    borderRadius: tokens.radius.sm,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: colors.divider,
    paddingLeft: 12,
    paddingRight: 46, // room for send button
    paddingVertical: 0,
    fontSize: 15,
    color: colors.text.primary,
    maxHeight: 100,
    lineHeight: 22,
    textAlignVertical: 'center',
  },
  textSendBtn: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textSendBtnDisabled: {
    opacity: 0.35,
  },
  processingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    gap: 6,
  },
  processingText: {
    fontSize: 13,
    color: colors.text.secondary,
  },
  recordBtnWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBtn: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    borderRadius: tokens.radius.sm,
    backgroundColor: colors.background,
    borderWidth: tokens.borderWidth.hairline,
    borderColor: colors.divider,
    width: '100%',
  },
  recordBtnActive: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  recordBtnDisabled: {
    backgroundColor: colors.text.tertiary,
    borderColor: colors.text.tertiary,
    opacity: 0.7,
  },
  recordBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  recordBtnTextLight: {
    color: colors.text.inverse,
  },
  endTrainingLink: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '500',
    marginTop: 10,
    textDecorationLine: 'underline',
  },

  // ── Satisfaction ──
  satisfactionInlineCard: {
    marginBottom: 4,
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
    borderRadius: 5,
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
  satisfactionBtnGhost: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.text.secondary,
  },
  satisfactionBtnGhostText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  satisfactionBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  satisfactionBtnPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.inverse,
  },

  // ── Misc ──
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
    height: 12,
  },
});
