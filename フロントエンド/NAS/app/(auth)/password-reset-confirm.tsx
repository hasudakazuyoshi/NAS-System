// app/(auth)/password-reset-confirm.tsx

import { Feather } from '@expo/vector-icons';
import { Href, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { resetPasswordByUserId, verifyPasswordResetToken } from '../../api/apiService';

export default function PasswordResetConfirmScreen() {
  const router = useRouter();
  const { uid, token } = useLocalSearchParams<{ uid: string; token: string }>();

  const [userId, setUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // ✅ 画面表示時にトークン検証（新規登録と同じパターン）
  useEffect(() => {
    const verifyToken = async () => {
      if (!uid || !token) {
        setErrorMessage('無効なリセットリンクです');
        setIsVerifying(false);
        return;
      }

      try {
        console.log('🔍 トークン検証開始');

        const response = await verifyPasswordResetToken(uid, token);

        if (response.valid) {
          console.log('✅ トークン検証成功');
          setUserId(response.user_id);
        } else {
          console.log('❌ トークン検証失敗:', response.error);
          setErrorMessage(response.error || '無効なリセットリンクです');
        }
      } catch (error: any) {
        console.error('❌ トークン検証エラー:', error);
        
        // ✅ 詳細なエラーメッセージを設定
        let errorMsg = '無効なリセットリンクです';
        
        if (error.message) {
          errorMsg = error.message;
        }
        
        // ネットワークエラーの場合
        if (error.message?.includes('Network') || error.message?.includes('fetch')) {
          errorMsg = 'ネットワークエラー: サーバーに接続できません';
        }
        
        setErrorMessage(errorMsg);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyToken();
  }, [uid, token]);

  const validatePasswords = () => {
    if (!newPassword || !confirmPassword) {
      setErrorMessage('すべての項目を入力してください');
      return false;
    }

    if (newPassword.length < 8) {
      setErrorMessage('パスワードは8文字以上で入力してください');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('パスワードが一致しません');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    setErrorMessage('');

    if (!validatePasswords()) {
      return;
    }

    if (!userId) {
      setErrorMessage('無効なリセットリンクです');
      return;
    }

    setIsLoading(true);

    try {
      console.log('📤 パスワードリセット実行');
      console.log('   user_id:', userId);

      await resetPasswordByUserId(userId, newPassword);

      console.log('✅ パスワードリセット成功');

      Alert.alert(
        '✅ パスワード変更完了',
        '新しいパスワードでログインしてください',
        [
          {
            text: 'OK',
            onPress: () => router.replace("/(auth)/" as Href)
          }
        ]
      );
    } catch (error: any) {
      console.error('❌ パスワードリセットエラー:', error);
      setErrorMessage(error.message || 'パスワードの変更に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ 検証中の表示
  if (isVerifying) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>リンクを確認しています...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ✅ 検証失敗時の表示（デバッグ情報付き）
  if (!userId && errorMessage) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.errorScreen}>
          <Feather name="alert-circle" size={64} color="#f44336" />
          <Text style={styles.errorTitle}>エラー</Text>
          <Text style={styles.errorDescription}>{errorMessage}</Text>
          
          {/* ✅ デバッグ情報を表示 */}
          <View style={styles.debugBox}>
            <Text style={styles.debugTitle}>デバッグ情報:</Text>
            <Text style={styles.debugText}>uid: {uid || '(なし)'}</Text>
            <Text style={styles.debugText}>token: {token ? token.substring(0, 30) + '...' : '(なし)'}</Text>
            <Text style={styles.debugText}>API: https://lacrimal-valleylike-lilyana.ngrok-free.dev/api</Text>
          </View>
          
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.replace("/(auth)/" as Href)}
          >
            <Text style={styles.backButtonText}>ログイン画面へ戻る</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          {/* アイコン */}
          <View style={styles.iconContainer}>
            <Feather name="lock" size={48} color="#4a90e2" />
          </View>

          <Text style={styles.title}>新しいパスワードを設定</Text>
          <Text style={styles.subtitle}>
            8文字以上のパスワードを入力してください
          </Text>

          {/* エラーメッセージ */}
          {errorMessage !== '' && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={20} color="#f44336" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* フォーム */}
          <View style={styles.form}>
            
            {/* 新しいパスワード */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>新しいパスワード</Text>
              <View style={styles.passwordWrapper}>
                <Feather name="lock" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={(text) => {
                    setNewPassword(text);
                    setErrorMessage('');
                  }}
                  secureTextEntry={!isPasswordVisible}
                  placeholder="8文字以上"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                >
                  <Feather
                    name={isPasswordVisible ? 'eye' : 'eye-off'}
                    size={22}
                    color="#555"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* パスワード確認 */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>パスワード確認</Text>
              <View style={styles.passwordWrapper}>
                <Feather name="lock" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={(text) => {
                    setConfirmPassword(text);
                    setErrorMessage('');
                  }}
                  secureTextEntry={!isConfirmVisible}
                  placeholder="もう一度入力"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.toggleButton}
                  onPress={() => setIsConfirmVisible(!isConfirmVisible)}
                >
                  <Feather
                    name={isConfirmVisible ? 'eye' : 'eye-off'}
                    size={22}
                    color="#555"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* 送信ボタン */}
            <TouchableOpacity
              style={[styles.submitButton, isLoading && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.submitButtonText}>変更中...</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>パスワードを変更</Text>
              )}
            </TouchableOpacity>

          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    alignItems: 'center',
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorScreen: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  debugBox: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
  },
  backButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  errorBox: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    borderColor: '#f44336',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  errorText: {
    color: '#f44336',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  form: {
    width: '100%',
    maxWidth: 400,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 1,
  },
  input: {
    width: '100%',
    padding: 14,
    paddingLeft: 44,
    paddingRight: 50,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  toggleButton: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
    padding: 10,
  },
  submitButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  disabledButton: {
    backgroundColor: '#d0d0d0',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
});