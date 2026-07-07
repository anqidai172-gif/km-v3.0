import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function MeshLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: '#0A0A1A' },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: '网状知识库',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
