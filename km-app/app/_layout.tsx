import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TabBar } from '../src/components/ui/TabBar';
import { useKnowledgeStore } from '../src/stores';
import { useSettingsStore } from '../src/stores';

export default function RootLayout() {
  useEffect(() => {
    // Initialize stores on app launch
    useKnowledgeStore.getState().loadAll();
    useKnowledgeStore.getState().loadCategories();
    useSettingsStore.getState().load();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
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
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
  },
});
