import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import 'react-native-url-polyfill/auto';

import { AppThemeProvider } from '@/lib/ThemeContext';

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <Stack initialRouteName="index">
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="onboarding/school" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="onboarding/register" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="onboarding/profile" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </AppThemeProvider>
  );
}
