import * as Linking from 'expo-linking';
import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { verifyEmailToken } from '../api/apiService';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { BLEProvider } from '../context/BLEContext';

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, setIsAuthenticated } = useAuth();

  useEffect(() => {
    const handleDeepLink = async ({ url }: { url: string }) => {
      console.log('--- Deep Link Received ---');
      console.log('URL:', url);
      
      const parsed = Linking.parse(url);
      const { hostname, queryParams } = parsed;
      
      console.log('Parsed hostname:', hostname);
      console.log('Parsed queryParams:', queryParams);
      
      // ✅ 修正: メールアドレス変更を先にチェック（より具体的な条件）
      // 1. メールアドレス変更確認
      if (hostname === 'verify-new-email' || url.includes('/verify-new-email')) {
        let token = queryParams?.token as string;
        
        // ✅ フォールバック: URLから直接抽出
        if (!token) {
          console.log('⚠️ token が空 - 手動パース実行');
          
          try {
            const urlObj = new URL(url.replace('nasapp://', 'http://'));
            token = urlObj.searchParams.get('token') || '';
            
            console.log('手動パース結果 - token:', token ? token.substring(0, 20) + '...' : '(なし)');
          } catch (error) {
            console.error('❌ URL手動パースエラー:', error);
          }
        }
        
        if (token) {
          // @ts-ignore: params passing
          router.push({
            pathname: '/(auth)/verify-new-email',
            params: { token }
          });
        }
      }
      
      // 2. メール認証（新規登録）
      // ✅ 修正: url.includes('/verify') を削除して厳密にチェック
      else if (hostname === 'verify') {
        const token = queryParams?.token as string;
        if (token) {
          await verifyEmailHandler(token);
        }
      }
      
      // 3. パスワードリセット確認画面へ
      else if (hostname === 'password-reset-confirm' || url.includes('/password-reset-confirm')) {
        // ✅ Linking.parse()が失敗する場合があるため、手動でパース
        let uid = queryParams?.uid as string;
        let token = queryParams?.token as string;
        
        // ✅ フォールバック: URLから直接抽出
        if (!uid || !token) {
          console.log('⚠️ queryParamsが空 - 手動パース実行');
          
          try {
            const urlObj = new URL(url.replace('nasapp://', 'http://'));
            uid = urlObj.searchParams.get('uid') || '';
            token = urlObj.searchParams.get('token') || '';
            
            console.log('手動パース結果 - uid:', uid);
            console.log('手動パース結果 - token:', token ? token.substring(0, 20) + '...' : '(なし)');
          } catch (error) {
            console.error('❌ URL手動パースエラー:', error);
          }
        }
        
        if (uid && token) {
          console.log('✅ uid/token両方あり - 画面遷移');
          // @ts-ignore: params passing
          router.push({
            pathname: '/(auth)/password-reset-confirm',
            params: { uid, token }
          });
        } else {
          console.log('❌ uid/tokenが不足');
          console.log('   uid:', uid || '(なし)');
          console.log('   token:', token || '(なし)');
        }
      }

      // 4. パスワードリセット要求画面へ
      else if (hostname === 'password-reset' || url.includes('/password-reset')) {
        router.push('/(auth)/password-reset');
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => subscription.remove();
  }, []);

  const verifyEmailHandler = async (token: string) => {
    try {
      const data = await verifyEmailToken(token);
      if (data.success) {
        setIsAuthenticated(true);
        Alert.alert('確認完了', '認証が完了しました。', [
          {
            text: 'OK',
            onPress: () => {
              router.replace({
                pathname: '/(auth)/complete-registration',
                params: { userId: data.user_id, email: data.email }
              });
            }
          }
        ]);
      } else {
        Alert.alert('エラー', data.error || '認証に失敗しました');
      }
    } catch (error: any) {
      Alert.alert('エラー', 'ネットワークエラーが発生しました。');
    }
  };

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';
    const isCompletingRegistration = segments[1] === 'complete-registration';

    if (!isAuthenticated && inAppGroup) {
      router.replace('/(auth)');
    } else if (isAuthenticated && inAuthGroup && !isCompletingRegistration) {
      router.replace('/(app)/user-home');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <BLEProvider>
      <AuthProvider>
        <RootLayoutContent />
      </AuthProvider>
    </BLEProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
});