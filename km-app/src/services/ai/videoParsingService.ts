/**
 * 视频/社交平台解析服务
 *
 * 将抖音、小红书等平台的分享链接发送到 server.js 后端，
 * 由 yt-dlp 下载字幕/元数据 → whisper 转录 → AI 总结。
 *
 * server.js 地址通过 settings.videoServerURL 配置。
 */

import type { ParseResult, ParsingRequest } from '../../types';
import { getIpAddressAsync } from 'expo-network';
import { setSetting } from '../../db/repositories/settingsRepo';

// ── 公网服务器地址（Cloudflare Tunnel） ──────────────────────
// 内测期间通过 cloudflared tunnel 暴露本地 server.js
// 每次重启 tunnel 后更新此地址：npx cloudflared tunnel --url http://localhost:3100
const CLOUDFLARE_TUNNEL_URL = 'https://annually-things-tsunami-denied.trycloudflare.com';

// ── 服务器地址容错 ──────────────────────────────────────────
// 当用户配置的地址不可达时，自动尝试以下备选地址
// （常见场景：IP 变更、从模拟器切换到真机、DHCP 重新分配）

const FALLBACK_SERVER_URLS = [
  'http://localhost:3100',
  'http://127.0.0.1:3100',
  'http://10.0.2.2:3100',   // Android 模拟器的宿主机 localhost
];

/**
 * 快速探测服务器是否可达（GET /api/health，2 秒超时）
 * 用于 fallback 选择，不抛出异常
 */
async function probeServer(url: string): Promise<boolean> {
  try {
    const base = url.replace(/\/+$/, '');
    const resp = await fetch(`${base}/api/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return false;
    const json = await resp.json().catch(() => null);
    return json?.status === 'ok';
  } catch {
    return false;
  }
}

// 限制错误日志刷屏（只打前几条）
let probeErrorCount = 0;

/**
 * 探测服务器是否可达（默认 1500ms 超时）
 * 使用 AbortController + setTimeout（兼容性优于 AbortSignal.timeout）
 */
async function probeServerFast(url: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(`${url}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!resp.ok) return false;
    const json = await resp.json().catch(() => null);
    return json?.status === 'ok';
  } catch (err: any) {
    // 只记录前几条错误，避免 254 条刷屏
    if (probeErrorCount < 3) {
      probeErrorCount++;
      const msg = err?.message || String(err);
      console.warn(`[probeFast] ${url} 探测失败: ${msg}`);
    }
    return false;
  }
}

/** DHCP 常用地址——精准打击，3000ms 长超时，确保不误判 */
const LUCKY_SHOTS = [1, 94, 100, 150, 200, 223, 254];

/** 先用长超时串行探测几个常用 DHCP 地址（约 3s 完成），命中则跳过全扫 */
async function targetedProbe(subnet: string, port: string): Promise<string | null> {
  for (const octet of LUCKY_SHOTS) {
    const url = `http://${subnet}.${octet}:${port}`;
    const ok = await probeServerFast(url, 3000);
    if (ok) {
      console.log(`[targetedProbe] ✅ 精准命中: ${url}`);
      return url;
    }
  }
  return null;
}

/**
 * 在同网段内扫描 server.js
 *
 * 1. 快速通道：配置 IP 末段 ±5（DHCP 变更多在相邻地址）
 * 2. 全量扫描：分批并发探测 1-254
 *
 * @returns 首个可达的 server.js 地址，或 null
 */
async function scanSubnet(configuredURL: string): Promise<string | null> {
  // 从配置 URL 提取 IP、端口、子网前缀
  // 例: http://10.237.230.223:3100 → prefix=10.237.230, port=3100
  const urlMatch = configuredURL.match(/^https?:\/\/(\d+)\.(\d+)\.(\d+)\.(\d+)(?::(\d+))?/);
  if (!urlMatch) return null; // 不是 IP 格式（如域名），跳过扫描

  const subnet = `${urlMatch[1]}.${urlMatch[2]}.${urlMatch[3]}`; // "10.237.230"
  const port = urlMatch[5] || '3100';
  const lastOctet = parseInt(urlMatch[4], 10); // 223

  // ── 快速通道：末段 ±5 ──
  const fastRange: number[] = [];
  for (let i = Math.max(1, lastOctet - 5); i <= Math.min(254, lastOctet + 5); i++) {
    if (i !== lastOctet) fastRange.push(i); // 跳过已探测的配置 IP
  }
  const fastResult = await batchProbe(fastRange, subnet, port);
  if (fastResult) return fastResult;

  // ── 全量扫描：1-254 ──
  const allIPs: number[] = [];
  for (let i = 1; i <= 254; i++) {
    if (i === lastOctet) continue; // 跳过已探测
    if (fastRange.includes(i)) continue; // 快速通道已探测
    allIPs.push(i);
  }

  return batchProbe(allIPs, subnet, port);
}

/** 小批量顺序探测，每批 8 并发，找到即返回。 */
async function batchProbe(
  octets: number[],
  subnet: string,
  port: string,
): Promise<string | null> {
  const CONCURRENCY = 8;
  for (let i = 0; i < octets.length; i += CONCURRENCY) {
    const chunk = octets.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (octet) => {
        const url = `http://${subnet}.${octet}:${port}`;
        const ok = await probeServerFast(url);
        return ok ? url : null;
      }),
    );
    const found = results.find((r): r is string => r !== null);
    if (found) return found;
  }
  return null;
}


// ── 自动发现：缓存 & 子网列表 ────────────────────────────
let cachedServerURL: string | null = null; // 发现一次后缓存，避免重复扫描

// 常见私有子网，按场景覆盖排列
const COMMON_SUBNETS = [
  '10.237.230',  // 公司 WiFi（用户实际场景）
  '192.168.43',  // Android 热点
  '172.20.10',   // iOS 热点
  '192.168.1',
  '192.168.0',
  '10.0.0',
  '172.16.0',
];

/** 判断是否为有效的局域网 IP */
function isValidLANIP(ip: string): boolean {
  if (!ip || ip === '0.0.0.0') return false;
  // 排除回环地址
  if (ip.startsWith('127.')) return false;
  // 排除链路本地地址
  if (ip.startsWith('169.254.')) return false;
  // 必须是四段
  return /^\d+\.\d+\.\d+\.\d+$/.test(ip);
}

/**

 * 自动发现局域网内的 server.js（零配置）
 *
 * 获取设备自身 IP → 提取子网 → 扫描同网段 3100 端口。
 * 设备 IP 无效时降级扫描常见私有子网。
 * 发现后缓存，后续调用直接返回缓存值。
 *
 * @returns 可达的 server.js 地址，或 null
 */
export async function autoDiscoverServer(): Promise<string | null> {
  // 重置错误日志计数器
  probeErrorCount = 0;

  // 缓存命中：探一下确认还活着
  if (cachedServerURL) {
    const alive = await probeServerFast(cachedServerURL);
    if (alive) return cachedServerURL;
    // 挂了，清缓存重新发现
    cachedServerURL = null;
  }

  try {
    const deviceIP = await getIpAddressAsync();
    const subnetsToScan: string[] = [];

    if (isValidLANIP(deviceIP)) {
      const ipMatch = deviceIP.match(/^(\d+\.\d+\.\d+)\.\d+$/);
      if (ipMatch) subnetsToScan.push(ipMatch[1]);
      console.log(`[autoDiscover] 设备 IP: ${deviceIP}`);
    } else {
      console.warn(`[autoDiscover] 设备 IP 无效 (${deviceIP || '(空)'})，降级扫描常见子网`);
      subnetsToScan.push(...COMMON_SUBNETS);
    }

    for (let si = 0; si < subnetsToScan.length; si++) {
      const subnet = subnetsToScan[si];
      console.log(`[autoDiscover] 扫描子网 ${subnet}.x`);

      // ── 精准打击：长超时探测常用 DHCP 地址 ──
      const targeted = await targetedProbe(subnet, '3100');
      if (targeted) {
        console.log(`[autoDiscover] ✅ 精准发现 server.js: ${targeted}`);
        cachedServerURL = targeted;
        setSetting('video_server_url', targeted).catch(() => {});
        return targeted;
      }

      // ── 精准打击未中 → 全子网扫描 ──
      // 首个子网（最可能）全扫 1-254，其余子网快速探 1-30
      const ipRange = si === 0
        ? Array.from({ length: 254 }, (_, i) => i + 1)
        : Array.from({ length: 30 }, (_, i) => i + 1);

      const result = await batchProbe(ipRange, subnet, '3100');
      if (result) {
        console.log(`[autoDiscover] ✅ 扫描发现 server.js: ${result}`);
        cachedServerURL = result;
        setSetting('video_server_url', result).catch(() => {});
        return result;
      }
    }

    console.log('[autoDiscover] 未找到 server.js');
    return null;
  } catch (err: any) {

    console.warn('[autoDiscover] 自动发现失败:', err.message);
    return null;
  }
}

/**
 * 解析实际可用的服务器地址
 *
 * 优先级：用户设置 > 硬编码隧道 > 自动发现局域网 > localhost
 */
export async function resolveServerURL(
  configuredURL?: string | null,
): Promise<{ url: string; usedFallback: boolean }> {
  const clean = (configuredURL || '').replace(/\/+$/, '');

  // 1. 用户在设置里填写的地址（可随时修改，无需重打 APK）
  if (clean) return { url: clean, usedFallback: false };

  // 2. 硬编码的 Cloudflare Tunnel 兜底
  if (CLOUDFLARE_TUNNEL_URL) return { url: CLOUDFLARE_TUNNEL_URL, usedFallback: false };

  // 3. 自动发现局域网服务
  console.warn('[resolveServerURL] 尝试自动发现...');
  const discovered = await autoDiscoverServer();
  if (discovered) {
    console.warn(`[resolveServerURL] ✅ 自动发现: ${discovered}`);
    return { url: discovered, usedFallback: true };
  }

  // 4. 全部失败 → localhost 兜底
  console.warn('[resolveServerURL] 自动发现失败，fallback 到 localhost');
  return { url: 'http://localhost:3100', usedFallback: false };
}

/** 后端 /api/parse 成功响应 */
interface ServerParseData {
  title: string;
  category?: string;
  tags?: string[];
  confidence?: number;
  summary?: string;
  keyPoints?: string[];
  excerpt?: string;
  sourceURL?: string;
  platform?: string;
  pageText?: string;
  imageText?: string;
  videoText?: string;
  contentLength?: number;
}

interface ServerResponse {
  success: boolean;
  data?: ServerParseData;
  error?: string;
}

/** 检测链接是否为视频/社交平台 URL（需要走后端解析） */
export function isPlatformVideoURL(url: string): boolean {
  const patterns = [
    // 抖音
    /douyin\.com\//i,
    /v\.douyin\.com\//i,
    /iesdouyin\.com\//i,
    // 小红书
    /xhslink\.(cn|com)/i,
    /xiaohongshu\.com/i,
    // YouTube
    /youtube\.com\/watch/i,
    /youtu\.be\//i,
    // Bilibili
    /bilibili\.com\/video/i,
    /b23\.tv\//i,
    // TikTok
    /tiktok\.com\//i,
    // Instagram
    /instagram\.com\/(reel|p)\//i,
    // Vimeo
    /vimeo\.com\//i,
    // Twitch
    /twitch\.tv\//i,
    // Twitter/X
    /x\.com\/.*\/status/i,
    /twitter\.com\/.*\/status/i,
  ];
  return patterns.some((p) => p.test(url));
}

/**
 * 从抖音/小红书等分享文案中提取纯链接
 *
 * 输入: "2.84 复制打开抖音，看看【杉树】... https://v.douyin.com/xxx/ c@a.Ag :6pm"
 * 输出: "https://v.douyin.com/xxx/"
 */
export function extractURLFromShareText(text: string): string {
  // 按平台短链接模式匹配，提取完整 URL
  const urlPatterns = [
    // 抖音短链: https://v.douyin.com/xxxxx/
    /https?:\/\/v\.douyin\.com\/[A-Za-z0-9_/-]+/,
    // 抖音长链: https://www.douyin.com/video/xxxxx 或 https://www.douyin.com/user/xxx?modal_id=xxx
    /https?:\/\/(?:www\.)?douyin\.com\/[^\s]+/,
    // iesdouyin
    /https?:\/\/iesdouyin\.com\/[^\s]+/,
    // 小红书短链
    /https?:\/\/xhslink\.(?:cn|com)\/[A-Za-z0-9_/-]+/,
    // 小红书长链
    /https?:\/\/(?:www\.)?xiaohongshu\.com\/[^\s]+/,
    // YouTube
    /https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[A-Za-z0-9_-]+[^\s]*/,
    /https?:\/\/youtu\.be\/[A-Za-z0-9_-]+/,
    // Bilibili
    /https?:\/\/(?:www\.)?bilibili\.com\/video\/[A-Za-z0-9]+/,
    /https?:\/\/b23\.tv\/[A-Za-z0-9]+/,
    // 通用: 以 http 开头的任意 URL
    /https?:\/\/[^\s]+/,
  ];

  for (const pattern of urlPatterns) {
    const match = text.match(pattern);
    if (match) {
      // 清理 URL 末尾的标点/特殊字符（中文标点、@、多余空格等）
      let url = match[0].replace(/[。，、；：！？…—~@#\$%&\*=+'"、,\s]+$/, '');
      // 去除末尾 /
      // url = url.replace(/\/$/, '');  // keep trailing slash, some platforms need it
      return url;
    }
  }

  // 没找到 URL，返回原文（可能用户直接贴的纯链接）
  return text.trim();
}

/** 获取平台名称（用于日志/UI） */
export function getPlatformName(url: string): string {
  if (/douyin|iesdouyin/i.test(url)) return '抖音';
  if (/xhslink|xiaohongshu/i.test(url)) return '小红书';
  if (/youtube|youtu\.be/i.test(url)) return 'YouTube';
  if (/bilibili|b23\.tv/i.test(url)) return 'Bilibili';
  if (/tiktok/i.test(url)) return 'TikTok';
  if (/instagram/i.test(url)) return 'Instagram';
  if (/vimeo/i.test(url)) return 'Vimeo';
  if (/twitch/i.test(url)) return 'Twitch';
  if (/twitter|x\.com/i.test(url)) return 'Twitter/X';
  return '视频平台';
}

/**
 * 将服务器返回数据映射为 App 的 ParseResult
 */
function mapServerDataToParseResult(
  data: ServerParseData,
  request: ParsingRequest,
): ParseResult {
  // 组装完整内容（页面文本 + 图片描述 + 视频转录）
  const contentParts: string[] = [];
  if (data.pageText) contentParts.push(data.pageText);
  if (data.imageText) contentParts.push(`[图片内容]\n${data.imageText}`);
  if (data.videoText) contentParts.push(`[视频转录]\n${data.videoText}`);
  const content = contentParts.join('\n\n') || data.summary || data.title || '';

  return {
    title: data.title || request.content.slice(0, 50),
    content: content.slice(0, 15000),
    suggestedCategoryId:
      request.targetCategories.find(
        (c) => c.name === data.category,
      )?.id || request.targetCategories[0]?.id || 'cat_other',
    suggestedCategoryName: data.category || '综合知识',
    suggestedTags: data.tags || [data.platform || '视频笔记'],
    confidence: data.confidence ?? 70,
    sourceSummary: data.summary || data.excerpt || '',
    extractedKeyPoints: data.keyPoints || [],
    videoText: data.videoText || undefined,
    pageText: data.pageText || undefined,
    imageText: data.imageText || undefined,
  };
}

/**
 * 调用 server.js 解析视频/平台链接
 *
 * @param request  解析请求
 * @param serverURL  server.js 地址（如 http://localhost:3100）
 * @param apiConfig  可选的 AI 配置（转发给 server）
 */
export async function parseViaServer(
  request: ParsingRequest,
  serverURL: string,
  apiConfig?: {
    apiKey?: string;
    provider?: string;
    baseURL?: string;
    model?: string;
    cookies?: string;
    asrProvider?: string;
    asrWhisperModel?: string;
    asrTencentSecretId?: string;
    asrTencentSecretKey?: string;
    asrAliyunAppKey?: string;
    asrAliyunAccessToken?: string;
    asrXunfeiAppId?: string;
    asrXunfeiApiKey?: string;
  },
): Promise<ParseResult> {
  // 智能解析服务器地址（配置地址不可达时自动 fallback）
  const { url: baseURL } = await resolveServerURL(serverURL);
  const url = `${baseURL}/api/parse`;

  // 从分享文案中提取纯 URL（如 "2.84 复制打开抖音... https://v.douyin.com/xxx/ c@a.Ag"）
  const cleanURL = extractURLFromShareText(request.content);

  const body: Record<string, string> = {
    url: cleanURL,
  };
  if (apiConfig?.apiKey) body.apiKey = apiConfig.apiKey;
  if (apiConfig?.provider) body.provider = apiConfig.provider;
  if (apiConfig?.baseURL) body.baseURL = apiConfig.baseURL;
  if (apiConfig?.model) body.model = apiConfig.model;
  if (apiConfig?.cookies) body.cookies = apiConfig.cookies;
  // ASR 配置
  if (apiConfig?.asrProvider) body.asrProvider = apiConfig.asrProvider;
  if (apiConfig?.asrWhisperModel) body.asrWhisperModel = apiConfig.asrWhisperModel;
  if (apiConfig?.asrTencentSecretId) body.asrTencentSecretId = apiConfig.asrTencentSecretId;
  if (apiConfig?.asrTencentSecretKey) body.asrTencentSecretKey = apiConfig.asrTencentSecretKey;
  if (apiConfig?.asrAliyunAppKey) body.asrAliyunAppKey = apiConfig.asrAliyunAppKey;
  if (apiConfig?.asrAliyunAccessToken) body.asrAliyunAccessToken = apiConfig.asrAliyunAccessToken;
  if (apiConfig?.asrXunfeiAppId) body.asrXunfeiAppId = apiConfig.asrXunfeiAppId;
  if (apiConfig?.asrXunfeiApiKey) body.asrXunfeiApiKey = apiConfig.asrXunfeiApiKey;

  // ── 构建 GET 请求 URL ──
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value) params.set(key, value);
  }
  params.set('async', '1'); // 异步模式：立即返回 taskId，后台处理
  const asyncURL = `${url}?${params.toString()}`;

  // ── 1. 发起异步解析请求 ──
  console.log(`[parseViaServer] 发起异步解析...`);
  let initResp: Response;
  try {
    initResp = await fetch(asyncURL, { method: 'GET' });
  } catch (err: any) {
    const errMsg: string = err?.cause?.message || err?.message || String(err);
    throw new Error(`视频解析服务连接失败: ${errMsg}`);
  }

  if (!initResp.ok) {
    const errText = await initResp.text().catch(() => '');
    throw new Error(`视频解析服务返回错误 (${initResp.status}): ${errText.slice(0, 200)}`);
  }

  let initJson: any;
  try {
    initJson = await initResp.json();
  } catch {
    throw new Error('无法解析服务器响应，请确认视频解析服务地址是否配置正确。');
  }

  // 兼容旧版 server（同步模式）：直接返回结果，无需轮询
  if (initJson.success && initJson.data) {
    console.log('[parseViaServer] 服务器同步返回结果（非异步模式）');
    return mapServerDataToParseResult(initJson.data, request);
  }

  const taskId: string = initJson.taskId;
  if (!taskId) {
    throw new Error(initJson.error || '视频解析服务未返回任务 ID（请升级 server.js 以支持异步模式）');
  }
  console.log(`[parseViaServer] 异步任务已创建: ${taskId}`);

  // ── 轮询等待结果（每 3 秒一次，最长 15 分钟）──
  const statusURL = `${baseURL}/api/parse-status?taskId=${encodeURIComponent(taskId)}`;
  const deadline = Date.now() + 15 * 60 * 1000;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    await new Promise((r) => setTimeout(r, 3000));

    let statusResp: Response;
    try {
      statusResp = await fetch(statusURL, { method: 'GET' });
    } catch (err: any) {
      const errMsg: string = err?.cause?.message || err?.message || String(err);
      console.warn(`[parseViaServer] 轮询失败 (第 ${attempt} 次): ${errMsg.slice(0, 80)}`);
      continue; // 网络抖动，继续轮询
    }

    if (!statusResp.ok) continue;

    let statusJson: any;
    try {
      statusJson = await statusResp.json();
    } catch { continue; }

    if (statusJson.status === 'done') {
      console.log(`[parseViaServer] ✅ 异步任务完成 (${attempt} 次轮询)`);
      return mapServerDataToParseResult(statusJson.data, request);
    }

    if (statusJson.status === 'error') {
      throw new Error(statusJson.error || '视频解析失败');
    }

    // status === 'processing' → 继续等待
    if (attempt % 5 === 0) {
      console.log(`[parseViaServer] 服务器仍在处理中... (已等待 ${attempt * 3}s)`);
    }
  }

  throw new Error(
    '视频解析处理超时（超过 15 分钟）。\n' +
    '服务器仍在运行但处理时间异常长，请检查网络后重试。',
  );
}

/** 测试 AI API 连接结果 */
export interface TestAuthResult {
  success: boolean;
  provider?: string;
  model?: string;
  error?: string;
  message?: string;
}

/** 从 baseURL 自动推断 AI 提供商 */
export function detectProvider(baseURL: string): string {
  if (/anthropic/i.test(baseURL)) return 'anthropic';
  if (/openai/i.test(baseURL)) return 'openai';
  if (/dashscope/i.test(baseURL)) return 'qwen';
  return 'deepseek';
}

/**
 * 通过 server.js 测试 AI API 连接
 *
 * @param serverURL  server.js 地址（如 http://localhost:3100）
 * @param apiConfig  AI 配置（apiKey, baseURL, model）
 */
export async function testAIConnection(
  serverURL: string,
  apiConfig?: {
    apiKey?: string;
    provider?: string;
    baseURL?: string;
    model?: string;
  },
): Promise<TestAuthResult> {
  const baseURL = serverURL.replace(/\/+$/, '');
  const url = `${baseURL}/api/test-auth`;

  const provider = apiConfig?.provider || detectProvider(apiConfig?.baseURL || '');

  const body: Record<string, string> = {};
  if (apiConfig?.apiKey) body.apiKey = apiConfig.apiKey;
  if (provider) body.provider = provider;
  if (apiConfig?.baseURL) body.baseURL = apiConfig.baseURL;
  if (apiConfig?.model) body.model = apiConfig.model;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err: any) {
    return {
      success: false,
      error: `无法连接测试服务: ${err.message}`,
    };
  }

  if (!resp.ok) {
    let detail = '';
    try {
      const text = await resp.text();
      // 如果是 HTML 错误页面，提取有用信息
      if (text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
        detail = ' (收到 HTML 错误页面，请检查服务器地址是否正确)';
      } else {
        detail = `: ${text.slice(0, 200)}`;
      }
    } catch {}
    return {
      success: false,
      error: `服务器返回错误 (${resp.status})${detail}`,
    };
  }

  // 检查 Content-Type，防止把 HTML 当 JSON 解析
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    let preview = '';
    try { preview = (await resp.text()).slice(0, 150); } catch {}
    return {
      success: false,
      error: preview.trim().startsWith('<!')
        ? '收到 HTML 页面而非 JSON 响应。请确认视频解析服务地址配置正确，当前可能连接到了错误的服务器。'
        : `服务器返回非 JSON 响应 (${contentType || '未知类型'}): ${preview}`,
    };
  }

  let json: any;
  try {
    json = await resp.json();
  } catch {
    return {
      success: false,
      error: '无法解析服务器返回的 JSON。请确认视频解析服务地址正确。',
    };
  }
  return {
    success: json.success ?? false,
    provider: json.provider,
    model: json.model,
    error: json.error,
  };
}

/** 服务器健康检查结果 */
export interface ServerHealthResult {
  ok: boolean;
  error?: string;
  ytdlp?: boolean;
  ffmpeg?: boolean;
  whisper?: boolean;
  apiKey?: boolean;
}

/**
 * 测试视频解析服务器连接（通过 /api/health 端点）
 */
export async function testServerConnection(serverURL: string): Promise<ServerHealthResult> {
  const baseURL = serverURL.replace(/\/+$/, '');
  const url = `${baseURL}/api/health`;

  let resp: Response;
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
  } catch (err: any) {
    return {
      ok: false,
      error: `无法连接服务器: ${err.message}`,
    };
  }

  if (!resp.ok) {
    return {
      ok: false,
      error: `服务器返回错误 (${resp.status})`,
    };
  }

  try {
    const json = await resp.json();
    return {
      ok: json.status === 'ok',
      ytdlp: json.ytdlp,
      ffmpeg: json.ffmpeg,
      whisper: json.whisper,
      apiKey: json.apiKey,
    };
  } catch {
    return {
      ok: false,
      error: '服务器返回了无效的响应格式',
    };
  }
}

/** ASR 用量信息 */
export interface ASRUsageInfo {
  month: string;
  usage: Record<string, number>;
  quotas: Record<string, number>;
  warnings: Record<string, boolean>;
}

/** 查询 ASR 月度用量 */
export async function fetchASRUsage(serverURL: string): Promise<ASRUsageInfo> {
  const baseURL = serverURL.replace(/\/+$/, '');
  const resp = await fetch(`${baseURL}/api/asr-usage`, { signal: AbortSignal.timeout(30000) });
  if (!resp.ok) throw new Error(`Server error: ${resp.status}`);
  return resp.json();
}

/** 测试 ASR 连接 */
export async function testASRConnection(
  serverURL: string,
  asrConfig: {
    provider?: string;
    whisperModel?: string;
    tencentSecretId?: string;
    tencentSecretKey?: string;
    aliyunAppKey?: string;
    aliyunAccessToken?: string;
    xunfeiAppId?: string;
    xunfeiApiKey?: string;
  },
): Promise<TestAuthResult> {
  const baseURL = serverURL.replace(/\/+$/, '');
  const resp = await fetch(`${baseURL}/api/test-asr`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(asrConfig),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) return { success: false, error: `Server error: ${resp.status}` };
  return resp.json();
}
