import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
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

// @ts-ignore
import { apiCall } from '../../api/apiService';

export default function EmailChangeScreen() {
  const router = useRouter();

  // 入力状態
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // 表示制御状態
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // メールアドレスのバリデーション
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // パスワード表示切り替え
  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  // 送信処理
  const handleSubmit = async () => {
    setErrorMessage('');

    // 1. 未入力チェック
    if (!newEmail.trim() || !password.trim()) {
      setErrorMessage('すべての項目を入力してください。');
      return;
    }

    // 2. メールアドレス形式チェック
    if (!validateEmail(newEmail)) {
      setErrorMessage('有効なメールアドレスを入力してください。');
      return;
    }

    // 3. パスワード文字数チェック
    if (password.length < 8) {
      setErrorMessage('パスワードは8文字以上で入力してください。');
      return;
    }

    setIsSaving(true);
    
    try {
      // ✅ 修正: 正しいエンドポイントに変更
      await apiCall('/auth/email/change/', 'POST', {
        new_email: newEmail.trim(),
        password: password
      }, true); // 認証が必要

      Alert.alert(
        "✅ 確認メール送信完了",
        `${newEmail}\n\n上記のメールアドレス宛に確認メールを送信しました。\nメールを確認して変更を完了してください。`,
        [
          { 
            text: "OK", 
            onPress: () => router.back() 
          }
        ]
      );

      // 入力内容をクリア
      setNewEmail('');
      setPassword('');

    } catch (error: any) {
      console.error("❌ メールアドレス変更エラー:", error);
      
      // エラーメッセージの判定
      let message = '通信エラーが発生しました。';
      
      if (error.message) {
        if (error.message.includes('password') || error.message.includes('パスワード')) {
          message = 'パスワードが正しくありません。';
          setPassword(''); // パスワードをクリア
        } else if (error.message.includes('email') || error.message.includes('メール')) {
          message = 'このメールアドレスは既に使用されています。';
        } else {
          message = error.message;
        }
      }
      
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          
          {/* ヘッダー */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Feather name="arrow-left" size={20} color="#333" />
              <Text style={styles.backButtonText}>戻る</Text>
            </TouchableOpacity>
          </View>

          {/* アイコン */}
          <View style={styles.iconContainer}>
            <Feather name="mail" size={48} color="#4a90e2" />
          </View>

          <Text style={styles.title}>メールアドレス変更</Text>

          {/* エラーメッセージ */}
          {errorMessage !== '' && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={20} color="#d32f2f" />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* フォーム */}
          <View style={styles.form}>
            
            {/* 新規メールアドレス */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                <Feather name="mail" size={16} color="#333" /> 新規メールアドレス
              </Text>
              <View style={styles.inputWrapper}>
                <Feather name="at-sign" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={newEmail}
                  onChangeText={(text) => {
                    setNewEmail(text);
                    setErrorMessage(''); // エラーをクリア
                  }}
                  placeholder="example@mail.com"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSaving}
                />
              </View>
            </View>

            {/* 確認パスワード */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                <Feather name="lock" size={16} color="#333" /> 確認パスワード
              </Text>
              <View style={styles.passwordWrapper}>
                <Feather name="key" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorMessage(''); // エラーをクリア
                  }}
                  secureTextEntry={!isPasswordVisible}
                  placeholder="現在のパスワード(8文字以上)"
                  placeholderTextColor="#999"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSaving}
                />
                <TouchableOpacity 
                  style={styles.toggleButton} 
                  onPress={togglePasswordVisibility}
                  activeOpacity={0.7}
                >
                  <Feather 
                    name={isPasswordVisible ? "eye" : "eye-off"} 
                    size={22} 
                    color="#555" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* 情報ボックス */}
            <View style={styles.infoBox}>
              <Feather name="info" size={20} color="#1976d2" />
              <Text style={styles.infoBoxText}>
                確認のため現在のパスワードを入力してください。
              </Text>
            </View>

            {/* 完了ボタン */}
            <TouchableOpacity 
              style={[
                styles.submitButton, 
                (isSaving || !newEmail || !password) && styles.disabledButton
              ]} 
              onPress={handleSubmit}
              disabled={isSaving || !newEmail || !password}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.submitButtonText}>送信中...</Text>
                </View>
              ) : (
                <Text style={styles.submitButtonText}>✉️ 確認メールを送信</Text>
              )}
            </TouchableOpacity>

          </View>

          {/* 下部説明 */}
          <View style={styles.noticeContainer}>
            <Feather name="bell" size={18} color="#ff9800" />
            <View style={styles.noticeTextContainer}>
              <Text style={styles.noticeTitle}>変更手順について</Text>
              <Text style={styles.noticeText}>
                1. 上記ボタンを押すと新しいメールアドレス宛に確認メールを送信します{'\n'}
                2. 受信したメール内のリンクをクリックして変更を完了してください{'\n'}
                3. 確認が完了するまで、現在のメールアドレスが有効です
              </Text>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  container: {
    padding: 20,
    alignItems: 'center',
    paddingBottom: 40,
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  backButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginLeft: 8,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  title: {
    textAlign: 'center',
    color: '#1a1a1a',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  errorBox: {
    width: '100%',
    maxWidth: 450,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffebee',
    borderColor: '#ef5350',
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  errorText: {
    color: '#d32f2f',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  form: {
    width: '100%',
    maxWidth: 450,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 10,
  },
  inputWrapper: {
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
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#1a1a1a',
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 50,
  },
  toggleButton: {
    position: 'absolute',
    right: 14,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  infoBoxText: {
    fontSize: 14,
    color: '#0d47a1',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#4a90e2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  disabledButton: {
    backgroundColor: '#d0d0d0',
    ...Platform.select({
      ios: {
        shadowOpacity: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noticeContainer: {
    width: '100%',
    maxWidth: 450,
    flexDirection: 'row',
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    borderRadius: 8,
    padding: 16,
    marginTop: 24,
  },
  noticeTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 22,
  },
});