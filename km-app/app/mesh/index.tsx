/**
 * 知识星图 — 力导向交互图谱
 * Force-directed graph with drag, zoom/pan, search highlight, macaron palette, blob background
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, Pressable, Dimensions, RefreshControl, Animated,
  TextInput, PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle, G, Line, Path, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors, tokens, fontFamily } from '../../src/theme';
import { pageContentPadding } from '../../src/theme/layout';
import { PageHeader } from '../../src/components/ui/PageHeader';
import { SearchIcon, CloseIcon } from '../../src/components/ui/ExpressionIcons';
import { useKnowledgeStore, useExpressionStore } from '../../src/stores';
import type { KnowledgeItem, KnowledgeCategory, TrainingRecord } from '../../src/types';

const { width: SW, height: SH } = Dimensions.get('window');
const SVG_W = SW;
const SVG_H = 520;
const NODE_R = 18;
const HIGHLIGHT_R = NODE_R + 12;

// ── Macaron palette ──
const MACARON = [
  '#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9',
  '#BAE1FF', '#D4BAFF', '#FFB3E0', '#B3FFE0',
  '#FFE0B3', '#C9BAFF', '#BAFFE0', '#FFBAD4',
];

function macaronColor(index: number) {
  return MACARON[index % MACARON.length];
}

// ── Types ──
interface GraphNode {
  id: string;
  item: KnowledgeItem;
  cat: KnowledgeCategory | undefined;
  record: TrainingRecord | undefined;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  isFocused: boolean;
  isExpanded: boolean;
  children: string[];
  level: number;
}

interface GraphEdge {
  source: string;
  target: string;
  type: 'parent' | 'child' | 'tag';
}

// ── Force simulation ──
function simulate(nodes: GraphNode[], edges: GraphEdge[], iterations: number) {
  const REPULSION = 6000;
  const ATTRACTION = 0.005;
  const CENTER_FORCE = 0.003;
  const DAMPING = 0.85;
  const cx = SVG_W / 2;
  const cy = SVG_H / 2;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = REPULSION / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx += fx;
        nodes[i].vy += fy;
        nodes[j].vx -= fx;
        nodes[j].vy -= fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const src = nodes.find((n) => n.id === edge.source);
      const tgt = nodes.find((n) => n.id === edge.target);
      if (!src || !tgt) continue;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const force = ATTRACTION * (dist - 80);
      const fx = (dx / Math.max(dist, 1)) * force;
      const fy = (dy / Math.max(dist, 1)) * force;
      src.vx += fx;
      src.vy += fy;
      tgt.vx -= fx;
      tgt.vy -= fy;
    }

    // Center gravity
    for (const node of nodes) {
      node.vx += (cx - node.x) * CENTER_FORCE;
      node.vy += (cy - node.y) * CENTER_FORCE;
    }

    // Apply velocity with damping
    for (const node of nodes) {
      node.x += node.vx;
      node.y += node.vy;
      node.vx *= DAMPING;
      node.vy *= DAMPING;
      // Clamp to bounds
      node.x = Math.max(NODE_R, Math.min(SVG_W - NODE_R, node.x));
      node.y = Math.max(NODE_R, Math.min(SVG_H - NODE_R, node.y));
    }
  }
}

// ── Animated Blob background ──
function BlobBg({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h} style={S.blobSvg}>
      <Defs>
        <RadialGradient id="blob1" cx="30%" cy="20%" r="50%">
          <Stop offset="0" stopColor="#FFB3BA" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#FFB3BA" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="blob2" cx="70%" cy="50%" r="55%">
          <Stop offset="0" stopColor="#BAE1FF" stopOpacity={0.22} />
          <Stop offset="1" stopColor="#BAE1FF" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="blob3" cx="50%" cy="75%" r="45%">
          <Stop offset="0" stopColor="#BAFFC9" stopOpacity={0.18} />
          <Stop offset="1" stopColor="#BAFFC9" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <SvgCircle cx={w * 0.3} cy={h * 0.25} r={Math.min(w, h) * 0.5} fill="url(#blob1)" />
      <SvgCircle cx={w * 0.7} cy={h * 0.5} r={Math.min(w, h) * 0.45} fill="url(#blob2)" />
      <SvgCircle cx={w * 0.5} cy={h * 0.8} r={Math.min(w, h) * 0.4} fill="url(#blob3)" />
    </Svg>
  );
}

export default function MeshPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const items = useKnowledgeStore((s) => s.items);
  const categories = useKnowledgeStore((s) => s.categories);
  const loadAll = useKnowledgeStore((s) => s.loadAll);
  const records = useExpressionStore((s) => s.records);
  const getConfirmedItems = useKnowledgeStore((s) => s.getConfirmedItems);

  const [refreshing, setRefreshing] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // Zoom/pan state
  const [viewBox, setViewBox] = useState(`0 0 ${SVG_W} ${SVG_H}`);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const dragNodeRef = useRef<string | null>(null);

  const confirmedItems = getConfirmedItems();
  const getCat = (id: string) => categories.find((c) => c.id === id);
  const getRec = (id: string) => records.find((r) => r.knowledgeItemId === id);

  useEffect(() => { loadAll(); }, []);

  // ── Parent category → color mapping ──
  const parentColorMap = useMemo(() => {
    const parentNames = new Map<string, number>(); // name → first-seen index
    const colors = new Map<string, string>();      // name → macaron color
    let idx = 0;
    for (const it of confirmedItems) {
      const cat = getCat(it.categoryId || '');
      const name = cat?.name || '未分类';
      if (!parentNames.has(name)) {
        parentNames.set(name, idx);
        colors.set(name, macaronColor(idx));
        idx++;
      }
    }
    return colors;
  }, [confirmedItems, getCat]);

  // ── Build graph ──
  const { nodes, edges, parentCenters } = useMemo(() => {
    const filtered = confirmedItems.filter((it) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return (
        it.title?.toLowerCase().includes(q) ||
        it.content?.toLowerCase().includes(q) ||
        (it.tags || []).some((t: string) => t.toLowerCase().includes(q))
      );
    });

    // Helper: get all parent names (primary + __pcat__ hidden tags)
    const getAllParentNames = (it: KnowledgeItem): string[] => {
      const names: string[] = [];
      const cat = getCat(it.categoryId || '');
      if (cat?.name) names.push(cat.name);
      // Extra parent categories from __pcat__ hidden tags
      const extraNames = (it.tags || [])
        .filter((t: string) => t.startsWith('__pcat__'))
        .map((t: string) => t.slice('__pcat__'.length));
      for (const n of extraNames) {
        if (!names.includes(n)) names.push(n);
      }
      if (names.length === 0) names.push('未分类');
      return names;
    };

    // Primary parent name for node color
    const getPrimaryParentName = (it: KnowledgeItem) => {
      const cat = getCat(it.categoryId || '');
      return cat?.name || '未分类';
    };

    // Build edges based on shared categories with types
    const e: GraphEdge[] = [];
    const seen = new Set<string>();

    // ── Parent edges (thick): each shared parent name → one edge per pair ──
    const parentNameGroups = new Map<string, string[]>();
    for (const it of filtered) {
      const names = getAllParentNames(it);
      for (const name of names) {
        if (!parentNameGroups.has(name)) parentNameGroups.set(name, []);
        parentNameGroups.get(name)!.push(it.id);
      }
    }
    for (const [, ids] of parentNameGroups) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const edgeKey = `parent:${[ids[i], ids[j]].sort().join('-')}`;
          if (!seen.has(edgeKey)) {
            seen.add(edgeKey);
            e.push({ source: ids[i], target: ids[j], type: 'parent' });
          }
        }
      }
    }

    // ── Child edges (thin): each shared sub-category → one edge per pair ──
    // Multiple shared sub-categories → multiple edges (drawn with slight offset)
    const subPairCount = new Map<string, number>(); // edgeKey → multiplicity
    const subGroups = new Map<string, string[]>();
    for (const it of filtered) {
      if (it.subCategoryId) {
        const key = it.subCategoryId;
        if (!subGroups.has(key)) subGroups.set(key, []);
        subGroups.get(key)!.push(it.id);
      }
    }
    for (const [, ids] of subGroups) {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const pairKey = [ids[i], ids[j]].sort().join('-');
          const count = (subPairCount.get(pairKey) || 0) + 1;
          subPairCount.set(pairKey, count);
          const edgeKey = `child:${pairKey}:${count}`;
          if (!seen.has(edgeKey)) {
            seen.add(edgeKey);
            e.push({ source: ids[i], target: ids[j], type: 'child' });
          }
        }
      }
    }

    // ── Tag edges (thinnest): shared regular tags ──
    const tagGroups = new Map<string, string[]>();
    for (const it of filtered) {
      const visibleTags = (it.tags || []).filter((t: string) => !t.startsWith('__pcat__'));
      for (const tag of visibleTags) {
        if (!tagGroups.has(tag)) tagGroups.set(tag, []);
        tagGroups.get(tag)!.push(it.id);
      }
    }
    for (const [, ids] of tagGroups) {
      if (ids.length > 1 && ids.length <= 5) {
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const edgeKey = `tag:${[ids[i], ids[j]].sort().join('-')}`;
            if (!seen.has(edgeKey)) {
              seen.add(edgeKey);
              e.push({ source: ids[i], target: ids[j], type: 'tag' });
            }
          }
        }
      }
    }

    // Create nodes with initial positions in a circle
    const n: GraphNode[] = [];
    const count = filtered.length;
    const cx = SVG_W / 2;
    const cy = SVG_H / 2;
    const ringRadius = Math.min(SVG_W, SVG_H) / 2.8;

    filtered.forEach((it, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(count, 1) - Math.PI / 2;
      const pName = getPrimaryParentName(it);
      n.push({
        id: it.id,
        item: it,
        cat: getCat(it.categoryId || ''),
        record: getRec(it.id),
        x: cx + ringRadius * Math.cos(angle) + (Math.random() - 0.5) * 40,
        y: cy + ringRadius * Math.sin(angle) + (Math.random() - 0.5) * 40,
        vx: 0, vy: 0,
        radius: NODE_R,
        color: parentColorMap.get(pName) || macaronColor(idx),
        isFocused: false,
        isExpanded: false,
        children: [],
        level: 0,
      });
    });

    // Run force simulation
    if (n.length > 1) simulate(n, e, 100);

    // Compute parent group centers for labels (based on primary parent)
    const centers = new Map<string, { x: number; y: number; color: string; count: number }>();
    for (const node of n) {
      const pName = getPrimaryParentName(node.item);
      if (!centers.has(pName)) {
        centers.set(pName, { x: 0, y: 0, color: node.color, count: 0 });
      }
      const c = centers.get(pName)!;
      c.x += node.x;
      c.y += node.y;
      c.count += 1;
    }
    for (const [name, c] of centers) {
      c.x /= c.count;
      c.y /= c.count;
    }

    return { nodes: n, edges: e, parentCenters: centers };
  }, [confirmedItems, searchQuery, getCat, getRec, parentColorMap]);

  // ── Search highlight effect ──
  const focusedNodeId = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.trim().toLowerCase();
    const match = nodes.find((n) =>
      n.item.title?.toLowerCase().includes(q) ||
      (n.item.tags || []).some((t: string) => t.toLowerCase().includes(q))
    );
    return match?.id ?? null;
  }, [searchQuery, nodes]);

  // Auto-pan to focused node
  useEffect(() => {
    if (!focusedNodeId) return;
    const node = nodes.find((n) => n.id === focusedNodeId);
    if (!node) return;
    const tx = SVG_W / 2 - node.x;
    const ty = SVG_H / 2 - node.y;
    offsetRef.current = { x: tx, y: ty };
    setOffset({ x: tx, y: ty });
    updateViewBox(scaleRef.current, { x: tx, y: ty });
  }, [focusedNodeId]);

  // ── Zoom/Pan ──
  const updateViewBox = useCallback((s: number, o: { x: number; y: number }) => {
    const w = SVG_W / s;
    const h = SVG_H / s;
    const x = -o.x / s;
    const y = -o.y / s;
    setViewBox(`${x} ${y} ${w} ${h}`);
  }, []);

  const handleZoomIn = () => {
    const ns = Math.min(scaleRef.current * 1.3, 3);
    scaleRef.current = ns;
    setScale(ns);
    updateViewBox(ns, offsetRef.current);
  };
  const handleZoomOut = () => {
    const ns = Math.max(scaleRef.current / 1.3, 0.4);
    scaleRef.current = ns;
    setScale(ns);
    updateViewBox(ns, offsetRef.current);
  };
  const resetView = () => {
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
    setScale(1);
    setOffset({ x: 0, y: 0 });
    updateViewBox(1, { x: 0, y: 0 });
  };

  // ── PanResponder for graph canvas ──
  const graphPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,
      onPanResponderMove: (_, gs) => {
        const nx = offsetRef.current.x + gs.dx / scaleRef.current;
        const ny = offsetRef.current.y + gs.dy / scaleRef.current;
        offsetRef.current = { x: nx, y: ny };
        setOffset({ x: nx, y: ny });
        updateViewBox(scaleRef.current, { x: nx, y: ny });
      },
      onPanResponderRelease: () => {},
    })
  ).current;

  // ── Node drag ──
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const nodePositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Category filter
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

  // ── Filter categories — group by ALL parent names (primary + __pcat__ extras) ──
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of confirmedItems) {
      const names = new Set<string>();
      const cat = getCat(it.categoryId || '');
      if (cat?.name) names.add(cat.name);
      (it.tags || [])
        .filter((t: string) => t.startsWith('__pcat__'))
        .forEach((t: string) => names.add(t.slice('__pcat__'.length)));
      if (names.size === 0) names.add('未分类');
      for (const name of names) {
        map.set(name, (map.get(name) || 0) + 1);
      }
    }
    return map;
  }, [confirmedItems, getCat]);

  // Filter nodes by selected category (checks primary + __pcat__ extras)
  const displayNodes = useMemo(() => {
    if (!selectedCategoryFilter) return nodes;
    return nodes.filter((n) => {
      const cat = getCat(n.item.categoryId || '');
      if ((cat?.name || '未分类') === selectedCategoryFilter) return true;
      // Also check __pcat__ hidden tags
      return (n.item.tags || []).some((t: string) =>
        t.startsWith('__pcat__') && t.slice('__pcat__'.length) === selectedCategoryFilter
      );
    });
  }, [nodes, selectedCategoryFilter, getCat]);

  const displayNodeIds = useMemo(() => new Set(displayNodes.map((n) => n.id)), [displayNodes]);

  const displayEdges = useMemo(() => {
    if (!selectedCategoryFilter) return edges;
    return edges.filter((e) => displayNodeIds.has(e.source) && displayNodeIds.has(e.target));
  }, [edges, selectedCategoryFilter, displayNodeIds]);

  // ── Node tap → modal ──
  const handleNodeTap = useCallback((node: GraphNode) => {
    setSelectedNode(node);
  }, []);

  const filteredCatNodes = useMemo(() => {
    // For filter display: all nodes used for category tags
    return nodes;
  }, [nodes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={S.container} edges={['top']}>
      <PageHeader title="知识星图" rightAction={
        <TouchableOpacity onPress={resetView} style={S.resetBtn} activeOpacity={0.7}>
          <Text style={S.resetBtnText}>重置</Text>
        </TouchableOpacity>
      } />

      {/* Search bar */}
      <View style={S.searchWrap}>
        <View style={S.searchBar}>
          <SearchIcon size={14} color={colors.text.tertiary} />
          <TextInput
            style={S.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="搜索知识节点..."
            placeholderTextColor={colors.text.tertiary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <CloseIcon size={14} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>
        <View style={S.zoomControls}>
          <TouchableOpacity onPress={handleZoomIn} style={S.zoomBtn}>
            <Text style={S.zoomBtnText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleZoomOut} style={S.zoomBtn}>
            <Text style={S.zoomBtnText}>−</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={S.statsBar}>
        <Text style={S.statsBarText}>
          {confirmedItems.length} 知识 · {displayNodes.length} 节点 · {displayEdges.length} 关联
        </Text>
        {searchQuery.trim() && focusedNodeId && (
          <Text style={S.clearFilterText}>
            已定位: {nodes.find((n) => n.id === focusedNodeId)?.item.title?.slice(0, 12)}...
          </Text>
        )}
      </View>

      {/* Graph canvas */}
      <View style={S.graphWrap} {...graphPan.panHandlers}>
        <BlobBg w={SVG_W} h={SVG_H} />
        <Svg width={SVG_W} height={SVG_H} viewBox={viewBox} style={S.graphSvg}>
          {/* Edges — thick for parent, thin for child (curved when multiple), thinnest for tag */}
          {(() => {
            // Count child edges per pair so we can curve them
            const childPairCounts = new Map<string, number>();
            for (const edge of displayEdges) {
              if (edge.type === 'child') {
                const k = [edge.source, edge.target].sort().join('-');
                childPairCounts.set(k, (childPairCounts.get(k) || 0) + 1);
              }
            }
            const childPairSeen = new Map<string, number>();

            return displayEdges.map((edge, i) => {
              const src = displayNodes.find((n) => n.id === edge.source);
              const tgt = displayNodes.find((n) => n.id === edge.target);
              if (!src || !tgt) return null;
              const isParent = edge.type === 'parent';
              const isChild = edge.type === 'child';
              const isTag = edge.type === 'tag';

              if (isChild) {
                const pairKey = [edge.source, edge.target].sort().join('-');
                const total = childPairCounts.get(pairKey) || 1;
                const idx = (childPairSeen.get(pairKey) || 0);
                childPairSeen.set(pairKey, idx + 1);

                if (total <= 1) {
                  // Single child edge — straight line
                  return (
                    <Line
                      key={`e-${i}`}
                      x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                      stroke={colors.divider}
                      strokeWidth={0.7}
                      opacity={0.35}
                    />
                  );
                }
                // Multiple child edges — curved (quadratic bezier with offset)
                const midX = (src.x + tgt.x) / 2;
                const midY = (src.y + tgt.y) / 2;
                const dx = tgt.x - src.x;
                const dy = tgt.y - src.y;
                const len = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
                const perpX = -dy / len;
                const perpY = dx / len;
                // Offset range: spread edges perpendicular to the line
                const spread = total - 1;
                const offset = (idx - spread / 2) * 9;
                const cx = midX + perpX * offset;
                const cy = midY + perpY * offset;
                return (
                  <Path
                    key={`e-${i}`}
                    d={`M${src.x},${src.y} Q${cx},${cy} ${tgt.x},${tgt.y}`}
                    stroke={colors.divider}
                    strokeWidth={0.7}
                    opacity={0.35}
                    fill="none"
                  />
                );
              }

              // Parent or tag — straight line
              return (
                <Line
                  key={`e-${i}`}
                  x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                  stroke={isParent ? src.color : colors.divider}
                  strokeWidth={isParent ? 2.8 : 0.4}
                  opacity={isParent ? 0.55 : 0.2}
                  strokeLinecap="round"
                />
              );
            });
          })()}

          {/* Parent category labels */}
          {Array.from(parentCenters.entries())
            .filter(([name]) => !selectedCategoryFilter || name === selectedCategoryFilter)
            .map(([name, c]) => (
            <G key={`plabel-${name}`}>
              <SvgCircle
                cx={c.x} cy={c.y} r={NODE_R + 4}
                fill={c.color}
                opacity={0.22}
              />
              <SvgCircle
                cx={c.x} cy={c.y} r={NODE_R + 4}
                fill="none"
                stroke="#3A3530"
                strokeWidth={1}
                strokeDasharray="8 4 6 3 10 4"
                strokeLinecap="round"
                opacity={0.30}
              />
              <SvgText
                x={c.x}
                y={c.y + 4}
                textAnchor="middle"
                fontSize={11}
                fontWeight="700"
                fill={colors.text.primary}
                fontFamily={fontFamily}
              >
                {name}
              </SvgText>
            </G>
          ))}

          {/* Nodes */}
          {displayNodes.map((node) => {
            const isFocused = node.id === focusedNodeId;
            const hasRecord = !!node.record;
            const state = node.record?.state;
            const isCompleted = state === 'retold' || state === 'restated';

            return (
              <G key={node.id}>
                {/* Glow ring for focused node — hand-drawn */}
                {isFocused && (
                  <SvgCircle
                    cx={node.x} cy={node.y} r={HIGHLIGHT_R}
                    fill="none"
                    stroke="#E05555"
                    strokeWidth={2.5}
                    strokeDasharray="7 3 5 4 9 2"
                    strokeLinecap="round"
                    opacity={0.7}
                  />
                )}
                {/* Outer glow */}
                {isFocused && (
                  <SvgCircle
                    cx={node.x} cy={node.y} r={HIGHLIGHT_R + 8}
                    fill="none"
                    stroke="#E05555"
                    strokeWidth={1.2}
                    strokeDasharray="4 5 8 3 6 4"
                    strokeLinecap="round"
                    opacity={0.3}
                  />
                )}
                {/* Node circle — hand-drawn pencil stroke: two overlapping dashed rings */}
                <SvgCircle
                  cx={node.x} cy={node.y} r={NODE_R}
                  fill={isCompleted ? colors.success : node.color}
                  stroke={isFocused ? '#E05555' : '#3A3530'}
                  strokeWidth={isFocused ? 2.8 : 1.2}
                  strokeDasharray="9 3 7 4 12 3"
                  strokeLinecap="round"
                  opacity={isFocused ? 1 : hasRecord ? 0.9 : 0.7}
                  onPress={() => handleNodeTap(node)}
                />
                <SvgCircle
                  cx={node.x} cy={node.y} r={NODE_R - 1}
                  fill="none"
                  stroke={isFocused ? '#E05555' : '#4A4440'}
                  strokeWidth={isFocused ? 1.5 : 0.7}
                  strokeDasharray="5 5 8 3 6 2"
                  strokeLinecap="round"
                  opacity={isFocused ? 0.7 : 0.30}
                  onPress={() => handleNodeTap(node)}
                />
                {/* Completion check */}
                {isCompleted && (
                  <SvgCircle
                    cx={node.x} cy={node.y} r={6}
                    fill={colors.text.inverse}
                    opacity={0.8}
                  />
                )}
                {/* Label */}
                <SvgText
                  x={node.x}
                  y={node.y + NODE_R + 14}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={isFocused ? '700' : '500'}
                  fill={isFocused ? colors.danger : colors.text.secondary}
                  fontFamily={fontFamily}
                >
                  {node.item.title?.slice(0, 6) || '...'}
                </SvgText>
              </G>
            );
          })}
        </Svg>
      </View>

      {/* Category filter tags — catChip style matching knowledge detail edit mode */}
      <View style={S.filterWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            key="all"
            style={[S.filterChip, !selectedCategoryFilter && S.filterChipActive]}
            activeOpacity={0.7}
            onPress={() => setSelectedCategoryFilter(null)}
          >
            <Text style={[S.filterChipText, !selectedCategoryFilter && S.filterChipTextActive]}>
              全部 ({confirmedItems.length})
            </Text>
          </TouchableOpacity>
          {Array.from(categoryCounts.entries()).map(([name, count]) => {
            const isActive = selectedCategoryFilter === name;
            return (
              <TouchableOpacity
                key={name}
                style={[S.filterChip, isActive && S.filterChipActive]}
                activeOpacity={0.7}
                onPress={() => setSelectedCategoryFilter(isActive ? null : name)}
              >
                <Text style={[S.filterChipText, isActive && S.filterChipTextActive]}>
                  {name} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <Text style={S.graphHint}>拖拽空白处平移 · 点击节点查看详情</Text>

      {/* Node detail modal */}
      <Modal visible={!!selectedNode} animationType="fade" transparent onRequestClose={() => setSelectedNode(null)}>
        <Pressable style={S.modalOverlay} onPress={() => setSelectedNode(null)}>
          <Pressable style={[S.modalSheet, { paddingBottom: (insets.bottom || 16) + 20 }]} onPress={() => {}}>
            {selectedNode && (() => {
              const item = selectedNode.item;
              const summary = item.aiSummary || item.contentPreview || item.content?.slice(0, 200) || '';
              const visibleTags = (item.tags || []).filter((t: string) => !t.startsWith('__pcat__'));
              const cat = getCat(item.categoryId || '');
              return (
              <>
                {/* Title */}
                <View style={S.modalColorBar}>
                  <View style={[S.modalColorDot, { backgroundColor: selectedNode.color }]} />
                  <Text style={S.modalTitle}>{item.title}</Text>
                </View>

                {/* AI Summary */}
                {summary ? (
                  <View style={S.modalSection}>
                    <Text style={S.modalSectionLabel}>AI 总结</Text>
                    <Text style={S.modalSummary} numberOfLines={4}>{summary}</Text>
                  </View>
                ) : null}

                {/* Category */}
                {cat && (
                  <View style={S.modalSection}>
                    <Text style={S.modalSectionLabel}>知识分类</Text>
                    <View style={S.modalTagRow}>
                      <View style={S.modalCatChip}>
                        <Text style={S.modalCatChipText}>{cat.name}</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Sub-tags */}
                {visibleTags.length > 0 && (
                  <View style={S.modalSection}>
                    <Text style={S.modalSectionLabel}>子标签</Text>
                    <View style={S.modalTagRow}>
                      {visibleTags.map((tag, i) => (
                        <View key={i} style={S.modalSubTag}>
                          <Text style={S.modalSubTagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {/* Action: view detail */}
                <TouchableOpacity
                  style={S.modalDetailBtn}
                  onPress={() => {
                    setSelectedNode(null);
                    router.push(`/knowledge/${item.id}`);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={S.modalDetailBtnText}>查看知识详情</Text>
                </TouchableOpacity>
              </>
            );})()}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    backgroundColor: colors.surface, borderBottomWidth: tokens.borderWidth.hairline, borderBottomColor: colors.divider,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.background, borderRadius: tokens.radius.md,
    paddingHorizontal: 10, height: 36, gap: 6,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text.primary, paddingVertical: 0 },
  zoomControls: { flexDirection: 'row', gap: 4 },
  zoomBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.divider,
    alignItems: 'center', justifyContent: 'center',
  },
  zoomBtnText: { fontSize: 16, fontWeight: '700', color: colors.text.primary },

  statsBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 4 },
  statsBarText: { fontSize: 13, color: colors.text.tertiary, fontFamily },
  clearFilterText: { fontSize: 12, color: colors.accent, fontWeight: '600' },

  graphWrap: { flex: 1, position: 'relative', overflow: 'hidden' },
  blobSvg: { position: 'absolute', top: 0, left: 0 },
  graphSvg: { backgroundColor: 'transparent' },

  filterWrap: { paddingHorizontal: 16, paddingVertical: 8 },
  filterChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: tokens.radius.sm,
    borderWidth: 1, borderColor: colors.divider,
    backgroundColor: colors.background,
    marginRight: 8,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: 13, color: colors.text.secondary, fontWeight: '500' },
  filterChipTextActive: { color: colors.text.inverse },

  graphHint: { fontSize: 11, color: colors.text.tertiary, textAlign: 'center', paddingBottom: 4 },

  resetBtn: { paddingVertical: 4, paddingHorizontal: 10 },
  resetBtnText: { fontSize: 13, color: colors.accent, fontWeight: '500' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(23,21,19,0.50)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface, borderTopLeftRadius: tokens.radius.lg, borderTopRightRadius: tokens.radius.lg,
    padding: 20, paddingBottom: 36,
  },
  modalColorBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  modalColorDot: { width: 14, height: 14, borderRadius: 7 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text.primary, fontFamily, flex: 1 },
  // Section
  modalSection: { marginBottom: 14 },
  modalSectionLabel: { fontSize: 13, color: colors.text.tertiary, fontWeight: '500', marginBottom: 6 },
  modalSummary: { fontSize: 14, color: colors.text.secondary, lineHeight: 22 },
  // Category chip
  modalTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  modalCatChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: tokens.radius.sm,
    borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.background,
  },
  modalCatChipText: { fontSize: 13, color: colors.text.secondary, fontWeight: '500' },
  // Sub-tag
  modalSubTag: {
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: tokens.radius.sm,
    backgroundColor: colors.primaryLight,
  },
  modalSubTagText: { fontSize: 12, color: colors.text.secondary },
  // Detail link
  modalDetailBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, marginTop: 6,
    borderRadius: tokens.radius.md,
    borderWidth: tokens.borderWidth.hairline, borderColor: colors.divider,
  },
  modalDetailBtnText: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
});
