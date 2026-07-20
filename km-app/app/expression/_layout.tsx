import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function ExpressionLayout() {
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
          title: '表达训练',
          headerLeft: () => null,
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[itemId]"
        options={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
