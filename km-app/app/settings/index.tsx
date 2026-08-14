import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, tokens, fontFamily } from '../../src/theme';
import { pageContentPadding } from '../../src/theme/layout';
import { Card } from '../../src/components/ui/Card';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { PencilIcon, CheckIcon, CloseIcon } from '../../src/components/ui/ExpressionIcons';
import { useSettingsStore, useKnowledgeStore } from '../../src/stores';
import { testAIConnection, testASRConnection, fetchASRUsage, resolveServerURL } from '../../src/services/ai/videoParsingService';
import { shareBackup, pickAndImport } from '../../src/services/backupService';
import type { KnowledgeCategory } from '../../src/types';

const CATEGORY_COLORS: readonly string[] = colors.categoryColors;

// ── API 预设 ──────────────────────────────────────────

interface ProviderPreset {
  label: string;
  baseURL: string;
  models: string[];
}

const PROVIDERS: ProviderPreset[] = [
  {
    label: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    models: ['deepseek-v4-pro', 'deepseek-v4-flash'],
  },
  {
    label: 'Anthropic',
    baseURL: 'https://api.anthropic.com',
    models: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  },
  {
    label: 'OpenAI',
    baseURL: 'https://api.openai.com',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'],
  },
  {
    label: '阿里云',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-vl-max', 'qwen-max', 'qwen-plus'],
  },
];

// ── ASR 预设 ──────────────────────────────────────────

interface ASRProviderPreset {
  label: string;
  provider: string;
  models: string[];
  description: string;
  freeQuota: string;
}

const ASR_PROVIDERS: ASRProviderPreset[] = [
  {
    label: '本地 Whisper',
    provider: 'local_whisper',
    models: ['tiny', 'small', 'medium'],
    description: '本地运行，无需网络，无限免费',
    freeQuota: '无限',
  },
  {
    label: '腾讯云 ASR',
    provider: 'tencent',
    models: [],
    description: '10小时/月免费，需 SecretId/Key',
    freeQuota: '600分钟',
  },
  {
    label: '阿里云 ASR',
    provider: 'aliyun',
    models: [],
    description: '5小时/月免费，需 AppKey/Token',
    freeQuota: '300分钟',
  },
  {
    label: '科大讯飞',
    provider: 'xunfei',
    models: [],
    description: '5小时/月免费，需 AppId/ApiKey',
    freeQuota: '300分钟',
  },
];

/** 根据 URL 匹配预设，找不到则返回空数组（用户自行填写） */
function getModelsForURL(url: string): string[] {
  const preset = PROVIDERS.find(
    (p) => p.baseURL.replace(/\/+$/, '') === url.replace(/\/+$/, ''),
  );
  return preset?.models || [];
}

export default function SettingsPage() {
  // Stores
  const settings = useSettingsStore((s) => s.settings);
  const load = useSettingsStore((s) => s.load);
  const updateReminder = useSettingsStore((s) => s.updateReminder);
  const updateThreshold = useSettingsStore((s) => s.updateThreshold);
  const updateAIConfig = useSettingsStore((s) => s.updateAIConfig);
  const addCategoryStore = useSettingsStore((s) => s.addCategory);
  const updateCategory = useSettingsStore((s) => s.updateCategory);
  const categories = useKnowledgeStore((s) => s.categories);
  const loadCat = useKnowledgeStore((s) => s.loadCategories);
  const deleteCategory = useKnowledgeStore((s) => s.deleteCategory);

  // Local state — threshold
  const [thresholdText, setThresholdText] = useState('');
  const [editingThreshold, setEditingThreshold] = useState(false);

  // Local state — API config
  const [apiBaseURL, setApiBaseURL] = useState(settings.aiBaseURL);
  const [apiModel, setApiModel] = useState(settings.aiModel);
  const [apiKey, setApiKey] = useState(settings.aiApiKey);
  const [showApiKey, setShowApiKey] = useState(false);
  const [videoServerURL, setVideoServerURL] = useState(settings.videoServerURL);

  // Local state — API test
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Local state — ASR config
  const [asrProvider, setAsrProvider] = useState(settings.asrProvider);
  const [asrWhisperModel, setAsrWhisperModel] = useState(settings.asrWhisperModel);
  const [asrTencentSID, setAsrTencentSID] = useState(settings.asrTencentSecretId);
  const [asrTencentSKey, setAsrTencentSKey] = useState(settings.asrTencentSecretKey);
  const [asrAliyunAppKey, setAsrAliyunAppKey] = useState(settings.asrAliyunAppKey);
  const [asrAliyunToken, setAsrAliyunToken] = useState(settings.asrAliyunAccessToken);
  const [asrXunfeiAppId, setAsrXunfeiAppId] = useState(settings.asrXunfeiAppId);
  const [asrXunfeiApiKey, setAsrXunfeiApiKey] = useState(settings.asrXunfeiApiKey);
  const [asrTestStatus, setAsrTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [asrTestMessage, setAsrTestMessage] = useState('');
  const [asrUsage, setAsrUsage] = useState<{ month: string; usage: Record<string, number>; quotas: Record<string, number>; warnings: Record<string, boolean> } | null>(null);

  // Synced state
  useEffect(() => { setAsrProvider(settings.asrProvider); }, [settings.asrProvider]);
  useEffect(() => { setAsrWhisperModel(settings.asrWhisperModel); }, [settings.asrWhisperModel]);

  // Local state — category inline editing
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(CATEGORY_COLORS[0]);

  useEffect(() => { load(); loadCat(); }, []);

  // Fetch ASR usage on page load and when provider changes
  useEffect(() => {
    (async () => {
      try {
        const serverURL = await getServerURL();
        const u = await fetchASRUsage(serverURL);
        setAsrUsage(u);
      } catch {}
    })();
  }, [asrProvider]);

  useEffect(() => { setThresholdText(String(settings.passThreshold)); }, [settings.passThreshold]);

  // ── 辅助：自动发现服务器地址 ─────────────────────────
  const getServerURL = async (): Promise<string> => {
    const { resolveServerURL } = await import('../../src/services/ai/videoParsingService');
    const resolved = await resolveServerURL();
    return resolved.url;
  };

  // ── Handlers ──────────────────────────────────────

  const handleReminderToggle = (enabled: boolean) => {
    updateReminder(enabled, settings.dailyReminderTime);
  };

  const handleTimeChange = (time: string) => {
    updateReminder(settings.dailyReminderEnabled, time);
  };

  const handleThresholdSave = () => {
    const v = parseInt(thresholdText, 10);
    if (isNaN(v) || v < 60 || v > 100) {
      Alert.alert('提示', '请输入 60-100 之间的整数');
      setThresholdText(String(settings.passThreshold));
      return;
    }
    updateThreshold(v);
    setEditingThreshold(false);
  };

  const handleApiSave = async () => {
    await updateAIConfig(apiBaseURL, apiModel, apiKey);
    Alert.alert('已保存', 'API 配置已更新');
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      Alert.alert('提示', '请先填写 API Key');
      return;
    }
    setTestStatus('testing');
    setTestMessage('');
    try {
      const serverURL = await getServerURL();
      const result = await testAIConnection(
        serverURL,
        { apiKey, baseURL: apiBaseURL, model: apiModel },
      );
      if (result.success) {
        setTestStatus('success');
        setTestMessage(`连接成功 — ${result.provider || ''} / ${result.model || ''}`);
      } else {
        setTestStatus('error');
        setTestMessage(`${result.error || '连接失败'}`);
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(`测试失败: ${err?.message || String(err)}`);
    }
  };

  const handleSaveASR = async () => {
    await useSettingsStore.getState().updateASRConfig({
      provider: asrProvider,
      whisperModel: asrWhisperModel,
      tencentSecretId: asrTencentSID,
      tencentSecretKey: asrTencentSKey,
      aliyunAppKey: asrAliyunAppKey,
      aliyunAccessToken: asrAliyunToken,
      xunfeiAppId: asrXunfeiAppId,
      xunfeiApiKey: asrXunfeiApiKey,
    });
    Alert.alert('已保存', 'ASR 配置已更新');
    // 重新加载用量（自动发现服务器）
    try {
      const serverURL = await getServerURL();
      const u = await fetchASRUsage(serverURL);
      setAsrUsage(u);
    } catch {}
  };

  const handleTestASR = async () => {
    setAsrTestStatus('testing');
    setAsrTestMessage('');
    try {
      const serverURL = await getServerURL();
      const result = await testASRConnection(
        serverURL,
        {
          provider: asrProvider,
          whisperModel: asrWhisperModel,
          tencentSecretId: asrTencentSID,
          tencentSecretKey: asrTencentSKey,
          aliyunAppKey: asrAliyunAppKey,
          aliyunAccessToken: asrAliyunToken,
          xunfeiAppId: asrXunfeiAppId,
          xunfeiApiKey: asrXunfeiApiKey,
        },
      );
      if (result.success) {
        setAsrTestStatus('success');
        setAsrTestMessage(`${result.message || '连接正常'}`);
      } else {
        setAsrTestStatus('error');
        setAsrTestMessage(`${result.error || '连接失败'}`);
      }
    } catch (err: any) {
      setAsrTestStatus('error');
      setAsrTestMessage(`测试失败: ${err?.message || String(err)}`);
    }
  };

  // Category: add
  const handleAddTag = () => {
    const name = newTagName.trim();
    if (!name) { setIsAddingTag(false); return; }
    addCategoryStore(name, newTagColor);
    setNewTagName('');
    setNewTagColor(CATEGORY_COLORS[0]);
    setIsAddingTag(false);
  };

  // Category: delete
  const handleDeleteCategory = (cat: KnowledgeCategory) => {
    const isOnlyCategory = categories.length <= 1;
    Alert.alert(
      '删除父分类',
      isOnlyCategory
        ? `删除「${cat.name}」后，该分类下的知识将归为"未分类"。确认删除？`
        : `确定要删除「${cat.name}」父分类吗？`,
      [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => deleteCategory(cat.id) },
      ]
    );
  };

  const timePresets = [
    { label: '08:00', time: '08:00' },
    { label: '09:00', time: '09:00' },
    { label: '20:00', time: '20:00' },
    { label: '21:00', time: '21:00' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <PageHeader title="个人设置" />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ═══ Daily Reminder ═══ */}
        <Text style={styles.sectionLabel}>每日提醒</Text>
        <Card elevated style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>每日复述提醒</Text>
              <Text style={styles.settingDesc}>开启后每天定时提醒你进行表达训练</Text>
            </View>
            <Switch
              value={settings.dailyReminderEnabled}
              onValueChange={handleReminderToggle}
              trackColor={{ false: colors.divider, true: colors.primaryLight }}
              thumbColor={settings.dailyReminderEnabled ? colors.accent : colors.surfaceLight}
            />
          </View>

          {settings.dailyReminderEnabled && (
            <View style={styles.timeSelector}>
              <Text style={styles.timeLabel}>提醒时间</Text>
              <View style={styles.timePresets}>
                {timePresets.map((preset) => (
                  <TouchableOpacity
                    key={preset.time}
                    style={[styles.timeChip, settings.dailyReminderTime === preset.time && styles.timeChipActive]}
                    onPress={() => handleTimeChange(preset.time)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.timeChipText, settings.dailyReminderTime === preset.time && styles.timeChipTextActive]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </Card>

        {/* ═══ Pass Threshold ═══ */}
        <Text style={styles.sectionLabel}>复述达标线</Text>
        <Card elevated style={styles.settingCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>达标分数</Text>
              <Text style={styles.settingDesc}>达到此分数视为复述合格 (60—100)</Text>
            </View>
            {editingThreshold ? (
              <View style={styles.inlineEditRow}>
                <TextInput
                  style={styles.inlineInput}
                  value={thresholdText}
                  onChangeText={setThresholdText}
                  keyboardType="numeric"
                  maxLength={3}
                  autoFocus
                  selectTextOnFocus
                />
                <TouchableOpacity onPress={handleThresholdSave} activeOpacity={0.7}>
                  <CheckIcon size={18} color={colors.success} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setEditingThreshold(false); setThresholdText(String(settings.passThreshold)); }} activeOpacity={0.7}>
                  <CloseIcon size={18} color={colors.text.tertiary} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.valueBtn} onPress={() => setEditingThreshold(true)} activeOpacity={0.7}>
                <Text style={styles.thresholdValue}>{settings.passThreshold} 分</Text>
                <PencilIcon size={12} color={colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* ═══ API Settings ═══ */}
        <Text style={styles.sectionLabel}>API 设置</Text>
        <Card elevated style={styles.settingCard}>
          <View style={styles.apiField}>
            <Text style={styles.apiLabel}>AI API 地址</Text>
            <TextInput
              style={styles.apiInput}
              value={apiBaseURL}
              onChangeText={setApiBaseURL}
              placeholder="https://api.deepseek.com"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
              <View style={styles.presetRow}>
                {PROVIDERS.map((p) => {
                  const isActive = p.baseURL.replace(/\/+$/, '') === apiBaseURL.replace(/\/+$/, '');
                  return (
                    <TouchableOpacity
                      key={p.label}
                      style={[styles.presetChip, isActive && styles.presetChipActive]}
                      onPress={() => {
                        setApiBaseURL(p.baseURL);
                        // 自动切换模型为当前 provider 的第一个
                        if (!getModelsForURL(apiModel).includes(apiModel)) {
                          setApiModel(p.models[0]);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
          <View style={styles.apiDivider} />
          <View style={styles.apiField}>
            <Text style={styles.apiLabel}>模型名称</Text>
            <TextInput
              style={styles.apiInput}
              value={apiModel}
              onChangeText={setApiModel}
              placeholder="deepseek-v4-pro"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {(() => {
              const modelPresets = getModelsForURL(apiBaseURL);
              if (modelPresets.length === 0) return null;
              return (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
                  <View style={styles.presetRow}>
                    {modelPresets.map((m) => {
                      const isActive = m === apiModel;
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[styles.presetChip, isActive && styles.presetChipActive]}
                          onPress={() => setApiModel(m)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                            {m}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              );
            })()}
          </View>
          <View style={styles.apiDivider} />
          <View style={styles.apiField}>
            <Text style={styles.apiLabel}>API Key</Text>
            <View style={styles.apiKeyRow}>
              <TextInput
                style={[styles.apiInput, {flex:1}]}
                value={apiKey}
                onChangeText={setApiKey}
                placeholder="sk-ant-..."
                placeholderTextColor={colors.text.tertiary}
                secureTextEntry={!showApiKey}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)} activeOpacity={0.7}>
                <Text style={styles.apiKeyToggle}>{showApiKey ? '隐藏' : '显示'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={styles.apiSaveBtn} onPress={handleApiSave} activeOpacity={0.7}>
            <Text style={styles.apiSaveBtnText}>保存 API 配置</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.apiTestBtn, testStatus === 'testing' && styles.apiTestBtnDisabled]}
            onPress={handleTestConnection}
            disabled={testStatus === 'testing'}
            activeOpacity={0.7}
          >
            <Text style={styles.apiTestBtnText}>
              {testStatus === 'testing' ? '测试中...' : '测试 API 连接'}
            </Text>
          </TouchableOpacity>

          {testMessage ? (
            <Text style={[styles.apiTestMsg, testStatus === 'error' && styles.apiTestMsgError]}>
              {testMessage}
            </Text>
          ) : null}
        </Card>

        {/* ═══ 视频解析 & 语音转写服务器 ═══ */}
        <Text style={styles.sectionLabel}>后端服务地址</Text>
        <Card elevated style={styles.settingCard}>
          <View style={styles.apiField}>
            <Text style={styles.apiLabel}>服务器地址</Text>
            <TextInput
              style={styles.apiInput}
              value={videoServerURL}
              onChangeText={setVideoServerURL}
              placeholder="Cloudflare Tunnel 公网地址"
              placeholderTextColor={colors.text.tertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <Text style={styles.backupHint}>
            用于视频链接解析和语音转写。内测期间填写 Cloudflare Tunnel 地址。留空则自动发现局域网服务。
          </Text>
          <TouchableOpacity
            style={styles.apiSaveBtn}
            onPress={async () => {
              await useSettingsStore.getState().updateVideoServerURL(videoServerURL.trim());
              Alert.alert('已保存', videoServerURL.trim() ? '服务器地址已更新' : '已清除，将使用自动发现');
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.apiSaveBtnText}>保存服务地址</Text>
          </TouchableOpacity>
        </Card>

        {/* ═══ ASR Settings ═══ */}
        <Text style={styles.sectionLabel}>语音转文字 (ASR)</Text>
        <Card elevated style={styles.settingCard}>
          <View style={styles.apiField}>
            <Text style={styles.apiLabel}>ASR 引擎</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
              <View style={styles.presetRow}>
                {ASR_PROVIDERS.map((p) => {
                  const isActive = p.provider === asrProvider;
                  return (
                    <TouchableOpacity
                      key={p.provider}
                      style={[styles.presetChip, isActive && styles.presetChipActive]}
                      onPress={() => setAsrProvider(p.provider)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            {/* Description and quota */}
            {(() => {
              const preset = ASR_PROVIDERS.find(p => p.provider === asrProvider);
              if (preset) {
                return <Text style={styles.asrDesc}>{preset.description}（免费: {preset.freeQuota}）</Text>;
              }
              return null;
            })()}
          </View>

          {/* Whisper model selector (only when local_whisper) */}
          {asrProvider === 'local_whisper' && (
            <>
              <View style={styles.apiDivider} />
              <View style={styles.apiField}>
                <Text style={styles.apiLabel}>Whisper 模型</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.presetScroll}>
                  <View style={styles.presetRow}>
                    {['tiny', 'small', 'medium'].map((m) => {
                      const isActive = m === asrWhisperModel;
                      return (
                        <TouchableOpacity
                          key={m}
                          style={[styles.presetChip, isActive && styles.presetChipActive]}
                          onPress={() => setAsrWhisperModel(m)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.presetChipText, isActive && styles.presetChipTextActive]}>
                            {m === 'tiny' ? 'tiny (快, 低精度)' : m === 'small' ? 'small (平衡)' : 'medium (慢, 高精度)'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </>
          )}

          {/* Tencent Cloud credentials */}
          {asrProvider === 'tencent' && (
            <>
              <View style={styles.apiDivider} />
              <View style={styles.apiField}>
                <Text style={styles.apiLabel}>SecretId</Text>
                <TextInput
                  style={styles.apiInput}
                  value={asrTencentSID}
                  onChangeText={setAsrTencentSID}
                  placeholder="AKID..."
                  placeholderTextColor={colors.text.tertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              <View style={styles.apiDivider} />
              <View style={styles.apiField}>
                <Text style={styles.apiLabel}>SecretKey</Text>
                <TextInput
                  style={styles.apiInput}
                  value={asrTencentSKey}
                  onChangeText={setAsrTencentSKey}
                  placeholder="..."
                  placeholderTextColor={colors.text.tertiary}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </>
          )}

          {/* Aliyun / Xunfei stub */}
          {(asrProvider === 'aliyun' || asrProvider === 'xunfei') && (
            <>
              <View style={styles.apiDivider} />
              <Text style={styles.asrStub}>
                {asrProvider === 'aliyun' ? '阿里云 ASR' : '科大讯飞 ASR'} 即将支持，当前将使用本地 Whisper 兜底。
              </Text>
            </>
          )}

          {/* Quota usage bar */}
          {asrUsage && asrProvider !== 'local_whisper' && (() => {
            const quota = asrUsage.quotas[asrProvider] || 0;
            const used = asrUsage.usage[asrProvider] || 0;
            const pct = quota > 0 ? Math.round(used * 100 / quota) : 0;
            const barColor = pct >= 100 ? colors.danger : pct >= 80 ? '#FFB347' : colors.success;
            return (
              <>
                <View style={styles.apiDivider} />
                <View style={styles.apiField}>
                  <Text style={styles.apiLabel}>本月用量</Text>
                  <View style={styles.usageBarWrap}>
                    <View style={styles.usageBarBg}>
                      <View style={[styles.usageBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }]} />
                    </View>
                    <Text style={[styles.usageBarText, pct >= 80 && { color: colors.danger }]}>
                      {used}/{quota} 分钟 ({pct}%)
                      {pct >= 100 ? '（已超额）' : pct >= 80 ? '（接近上限）' : ''}
                    </Text>
                  </View>
                </View>
              </>
            );
          })()}

          <TouchableOpacity style={styles.apiSaveBtn} onPress={handleSaveASR} activeOpacity={0.7}>
            <Text style={styles.apiSaveBtnText}>保存 ASR 配置</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.apiTestBtn, asrTestStatus === 'testing' && styles.apiTestBtnDisabled]}
            onPress={handleTestASR}
            disabled={asrTestStatus === 'testing'}
            activeOpacity={0.7}
          >
            <Text style={styles.apiTestBtnText}>
              {asrTestStatus === 'testing' ? '测试中...' : '测试 ASR 连接'}
            </Text>
          </TouchableOpacity>

          {asrTestMessage ? (
            <Text style={[styles.apiTestMsg, asrTestStatus === 'error' && styles.apiTestMsgError]}>
              {asrTestMessage}
            </Text>
          ) : null}
        </Card>

        <Text style={styles.sectionLabel}>父分类管理</Text>
        <Card elevated style={styles.settingCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagScroll}>
            <View style={styles.tagRow}>
              {categories.filter((cat) => !cat.parentId).map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.familyCatChip}
                  onPress={() => handleDeleteCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.familyCatChipText}>{cat.name} ✕</Text>
                </TouchableOpacity>
              ))}

              {isAddingTag ? (
                <View style={styles.addTagActiveRow}>
                  <TextInput
                    style={styles.addTagInput}
                    placeholder="分类名"
                    placeholderTextColor={colors.text.tertiary}
                    value={newTagName}
                    onChangeText={setNewTagName}
                    onSubmitEditing={handleAddTag}
                    onBlur={handleAddTag}
                    autoFocus
                  />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addTagBtn}
                  onPress={() => { setIsAddingTag(true); setNewTagName(''); setNewTagColor(CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.addTagBtnText}>+ 新增父分类</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </Card>

        {/* ═══ 数据备份 ═══ */}
        <Text style={styles.sectionLabel}>数据备份</Text>
        <Card elevated style={styles.settingCard}>
          <Text style={styles.backupHint}>
            将全部知识条目、训练记录和设置导出为 JSON 文件，可用于换机迁移或定期备份。
          </Text>
          <View style={styles.backupBtnRow}>
            <TouchableOpacity
              style={styles.backupBtn}
              onPress={async () => {
                try {
                  await shareBackup();
                } catch (e: any) {
                  Alert.alert('导出失败', e?.message || '未知错误');
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.backupBtnText}>导出备份</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backupBtnOutline}
              onPress={async () => {
                try {
                  const result = await pickAndImport();
                  Alert.alert(
                    '导入完成',
                    `成功导入 ${result.imported} 条，跳过 ${result.skipped} 条（已存在）`,
                  );
                } catch (e: any) {
                  if (e?.message === '未选择文件') return;
                  Alert.alert('导入失败', e?.message || '未知错误');
                }
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.backupBtnOutlineText}>导入备份</Text>
            </TouchableOpacity>
          </View>
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scrollContent: { ...pageContentPadding },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: colors.text.tertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginBottom: 6, marginTop: 14, marginLeft: 4,
    fontFamily,
  },
  settingCard: { marginBottom: 6 },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingInfo: { flex: 1, marginRight: 16 },
  settingTitle: { fontSize: 15, fontWeight: '600', color: colors.text.primary, marginBottom: 2 },
  settingDesc: { fontSize: 12, color: colors.text.secondary, lineHeight: 17 },

  // Time
  timeSelector: { marginTop: 14, paddingTop: 14, borderTopWidth: tokens.borderWidth.hairline, borderTopColor: colors.divider },
  timeLabel: { fontSize: 13, color: colors.text.secondary, marginBottom: 8 },
  timePresets: { flexDirection: 'row', gap: 8 },
  timeChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 3,
    backgroundColor: colors.primaryLight, borderWidth: tokens.borderWidth.hairline, borderColor: colors.divider,
  },
  timeChipActive: { backgroundColor: colors.primary },
  timeChipText: { fontSize: 13, color: colors.text.secondary },
  timeChipTextActive: { color: colors.text.inverse, fontWeight: '600' },

  // Threshold
  valueBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  thresholdValue: { fontSize: 22, fontWeight: '700', color: colors.text.primary, fontFamily },
  inlineEditRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineInput: {
    fontSize: 22, fontWeight: '700', color: colors.text.primary, fontFamily,
    borderBottomWidth: tokens.borderWidth.hairline, borderBottomColor: colors.divider,
    paddingVertical: 2, minWidth: 50, textAlign: 'center',
  },

  // API
  apiField: { gap: 6 },
  apiLabel: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  apiInput: {
    fontSize: 14, color: colors.text.primary,
    backgroundColor: colors.background, borderRadius: 5,
    borderWidth: tokens.borderWidth.hairline, borderColor: colors.divider,
    paddingVertical: 10, paddingHorizontal: 12,
  },
  apiDivider: { height: tokens.borderWidth.hairline, backgroundColor: colors.divider, marginVertical: 12 },
  presetScroll: { marginTop: 8 },
  presetRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  presetChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 3,
    backgroundColor: colors.primaryLight, borderWidth: tokens.borderWidth.hairline, borderColor: colors.divider,
  },
  presetChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  presetChipText: { fontSize: 12, color: colors.text.secondary, fontWeight: '500' },
  presetChipTextActive: { color: colors.text.inverse, fontWeight: '600' },
  apiKeyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  apiKeyToggle: { fontSize: 13, color: colors.accent, fontWeight: '500' },
  apiSaveBtn: {
    marginTop: 14, paddingVertical: 12,
    backgroundColor: colors.primary, borderRadius: 5,
    alignItems: 'center',
  },
  apiSaveBtnText: { fontSize: 14, fontWeight: '700', color: colors.text.inverse },
  apiTestBtn: {
    marginTop: 10, paddingVertical: 11,
    backgroundColor: 'transparent', borderRadius: 5,
    borderWidth: 1, borderColor: colors.accent,
    alignItems: 'center',
  },
  apiTestBtnDisabled: { opacity: 0.5 },
  apiTestBtnText: { fontSize: 14, fontWeight: '600', color: colors.accent },
  apiTestMsg: {
    marginTop: 10, fontSize: 13, color: colors.success,
    textAlign: 'center', lineHeight: 18,
  },
  apiTestMsgError: { color: colors.danger },
  asrDesc: { fontSize: 12, color: colors.text.secondary, marginTop: 6, lineHeight: 17 },
  asrStub: { fontSize: 13, color: colors.text.tertiary, textAlign: 'center', paddingVertical: 8 },
  usageBarWrap: { marginTop: 4 },
  usageBarBg: { height: 8, backgroundColor: colors.primaryLight, borderRadius: 4, overflow: 'hidden' },
  usageBarFill: { height: 8, borderRadius: 4 },
  usageBarText: { fontSize: 12, color: colors.text.secondary, marginTop: 4 },

  // Category tags — horizontal scrollable, Badge-style pencil border
  tagScroll: { marginHorizontal: -3, paddingHorizontal: 3 },
  tagRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  // Parent category chips (matching knowledge mesh filterChip style)
  familyCatChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: tokens.radius.sm,
    borderWidth: 1, borderColor: colors.divider,
    backgroundColor: colors.background,
    marginRight: 8,
  },
  familyCatChipText: { fontSize: 13, color: colors.text.secondary, fontWeight: '500' },

  // Add tag
  addTagBtn: {
    borderRadius: 3, borderWidth: tokens.borderWidth.hairline, borderColor: colors.divider,
    paddingVertical: 3, paddingHorizontal: 10, borderStyle: 'dashed',
  },
  addTagBtnText: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  addTagActiveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(245,240,230,0.5)', borderRadius: 3,
    paddingVertical: 3, paddingHorizontal: 8,
    borderWidth: tokens.borderWidth.hairline, borderColor: colors.divider,
  },
  addTagInput: {
    fontSize: 13, color: colors.text.secondary,
    paddingVertical: 0, minWidth: 50,
  },

  // Backup
  backupHint: { fontSize: 13, color: colors.text.secondary, lineHeight: 20, marginBottom: 14 },
  backupBtnRow: { flexDirection: 'row', gap: 10 },
  backupBtn: {
    flex: 1, backgroundColor: colors.primary, borderRadius: tokens.radius.md,
    paddingVertical: 12, alignItems: 'center',
  },
  backupBtnText: { fontSize: 15, fontWeight: '700', color: colors.text.inverse },
  backupBtnOutline: {
    flex: 1, borderRadius: tokens.radius.md, paddingVertical: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.divider,
  },
  backupBtnOutlineText: { fontSize: 15, fontWeight: '600', color: colors.text.primary },

  bottomSpacer: { height: 20 },
});
