import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function InputLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text.primary,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: '知识输入',
          headerShown: false,
        }}
      />
    </Stack>
  );
}
