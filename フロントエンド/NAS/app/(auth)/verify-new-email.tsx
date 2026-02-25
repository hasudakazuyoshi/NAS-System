// app/(auth)/verify-new-email.tsx

import { Feather } from '@expo/vector-icons';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

import { confirmEmailChange } from '../../api/apiService';

export default function VerifyNewEmailScreen() {
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  
  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // ✅ 実行中フラグ（useRef で同期的にチェック）
  const isExecuting = React.useRef(false);

  useEffect(() => {
    if (!token) {
      setIsVerifying(false);
      setErrorMessage('トークンが見つかりません');
      return;
    }
    
    // ✅ 既に実行中ならスキップ（同期チェック）
    if (isExecuting.current) {
      console.log('⚠️ 既に実行中 - スキップ');
      return;
    }
    
    // ✅ 実行中フラグを立てる（即座に）
    isExecuting.current = true;
    console.log('✅ 検証開始');
    
    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      console.log('📤 メールアドレス変更確認');
      console.log('🔑 token:', token);

      const data = await confirmEmailChange(token);

      console.log('✅ メールアドレス変更成功:', data);
      
      setIsSuccess(true);
      setNewEmail(data.new_email || '');
    } catch (error: any) {
      console.error('❌ メールアドレス変更エラー:', error);
      setIsSuccess(false);
      setErrorMessage(error.message || 'メールアドレスの変更に失敗しました');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleGoToLogin = () => {
    router.replace("/(auth)/" as Href);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {isVerifying ? (
          // 確認中
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#4a90e2" />
            <Text style={styles.loadingText}>メールアドレスを変更しています...</Text>
          </View>
        ) : isSuccess ? (
          // 成功
          <View style={styles.centerBox}>
            <View style={styles.iconContainer}>
              <Feather name="check-circle" size={64} color="#4CAF50" />
            </View>
            <Text style={styles.title}>メールアドレス変更完了</Text>
            <Text style={styles.message}>
              メールアドレスを{'\n'}
              <Text style={styles.emailText}>{newEmail}</Text>{'\n'}
              に変更しました
            </Text>
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleGoToLogin}
            >
              <Text style={styles.buttonText}>ログイン画面へ</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // 失敗
          <View style={styles.centerBox}>
            <View style={styles.iconContainer}>
              <Feather name="x-circle" size={64} color="#f44336" />
            </View>
            <Text style={styles.title}>変更に失敗しました</Text>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity 
              style={styles.button} 
              onPress={() => router.back()}
            >
              <Text style={styles.buttonText}>戻る</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  centerBox: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  emailText: {
    fontWeight: 'bold',
    color: '#4a90e2',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorText: {
    fontSize: 14,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#4a90e2',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});