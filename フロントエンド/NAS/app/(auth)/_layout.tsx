import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    // (auth)グループ内の画面遷移を管理するスタックナビゲーター
    // headerShown: false にして、デフォルトのヘッダーを隠します
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="register" />
    </Stack>
  );
}