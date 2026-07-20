import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, tokens } from '../../theme';
import { HomeIcon, TrainIcon, InputIcon, MeshIcon, SettingsIcon } from './TabIcons';
import type { FC } from 'react';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TabItem {
  path: string;
  label: string;
  Icon: FC<{ size?: number; color?: string; active?: boolean }>;
}

const TAB_ICON_SIZE = 22;

const TABS: TabItem[] = [
  { path: '/expression', label: '表达训练', Icon: TrainIcon },
  { path: '/input',      label: '知识输入', Icon: InputIcon },
  { path: '/home',       label: '首页',     Icon: HomeIcon },
  { path: '/mesh',       label: '知识星图', Icon: MeshIcon },
  { path: '/settings',   label: '个人设置', Icon: SettingsIcon },
];

export function TabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isActive = (path: string) => pathname.startsWith(path);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {/* SVG 铅笔手绘上缘分界线 */}
      <View style={styles.pencilDivider} pointerEvents="none">
        <Svg width={SCREEN_WIDTH} height={10} viewBox={`0 0 ${SCREEN_WIDTH} 10`}>
          <Path d={`M 0,6 Q ${SCREEN_WIDTH*0.25},2 ${SCREEN_WIDTH*0.5},5 T ${SCREEN_WIDTH},4`}
            stroke="#3A3530" strokeWidth={1.4} strokeDasharray="18 5 10 3 22 5"
            strokeLinecap="round" fill="none" opacity={0.40} />
          <Path d={`M 0,5 Q ${SCREEN_WIDTH*0.3},3 ${SCREEN_WIDTH*0.5},4 T ${SCREEN_WIDTH},6`}
            stroke="#4A4440" strokeWidth={1.0} strokeDasharray="10 6 8 3 14 5 6 4"
            strokeLinecap="round" fill="none" opacity={0.32} />
          <Path d={`M 0,7 Q ${SCREEN_WIDTH*0.2},1 ${SCREEN_WIDTH*0.5},6 T ${SCREEN_WIDTH},3`}
            stroke="#3F3A36" strokeWidth={1.2} strokeDasharray="24 4 14 4 28 3"
            strokeLinecap="round" fill="none" opacity={0.35} />
        </Svg>
      </View>
      {TABS.map((tab) => {
        const active = isActive(tab.path);
        return (
          <TouchableOpacity key={tab.path} style={styles.tab}
            onPress={() => router.replace(tab.path)} activeOpacity={0.7}>
            <tab.Icon size={TAB_ICON_SIZE}
              color={active ? colors.accent : colors.text.tertiary} active={active} />
            <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
            {active && <View style={styles.indicator} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection:'row', backgroundColor:colors.surface, paddingBottom:20, paddingTop:8 },
  pencilDivider: {
    position: 'absolute', top: -5, left: 0, right: 0, height: 10, zIndex: 1,
  },
  tab: { flex:1, alignItems:'center', justifyContent:'center', paddingVertical:4, position:'relative' },
  label: { fontSize:11, color:colors.text.tertiary, fontWeight:'500' },
  labelActive: { color:colors.accent, fontWeight:'600' },
  indicator: { position:'absolute', top:-9, width:20, height:3, borderRadius:tokens.radius.sm, backgroundColor:colors.accent },
});
