import { Stack } from 'expo-router';

export default function AppLayout() {
  // ここはログイン後の画面（ホームやグラフ）を表示するだけの箱です
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}