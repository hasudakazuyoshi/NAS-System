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
import { changePassword } from '../../api/apiService';

export default function PasswordChangeScreen() {
  const router = useRouter();

  // 入力値
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 表示制御
  const [isOldVisible, setIsOldVisible] = useState(false);
  const [isNewVisible, setIsNewVisible] = useState(false);
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // パスワード強度チェック
  const checkPasswordStrength = (password: string): string => {
    if (password.length < 8) return 'weak';
    
    let strength = 0;
    if (/[a-z]/.test(password)) strength++; // 小文字
    if (/[A-Z]/.test(password)) strength++; // 大文字
    if (/[0-9]/.test(password)) strength++; // 数字
    if (/[^a-zA-Z0-9]/.test(password)) strength++; // 記号
    
    if (strength >= 3) return 'strong';
    if (strength >= 2) return 'medium';
    return 'weak';
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'strong': return '#4caf50';
      case 'medium': return '#ff9800';
      default: return '#f44336';
    }
  };

  const getStrengthText = (strength: string) => {
    switch (strength) {
      case 'strong': return '強い';
      case 'medium': return '普通';
      default: return '弱い';
    }
  };

  const passwordStrength = newPassword ? checkPasswordStrength(newPassword) : '';

  // 変更処理
  const handleChange = async () => {
    setErrorMessage('');

    // 1. 未入力チェック
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setErrorMessage('すべての項目を入力してください。');
      return;
    }

    // 2. 文字数チェック
    if (newPassword.length < 8) {
      setErrorMessage('新しいパスワードは8文字以上で入力してください。');
      return;
    }

    // 3. 一致チェック
    if (newPassword !== confirmPassword) {
      setErrorMessage('新しいパスワードと確認パスワードが一致しません。');
      return;
    }

    // 4. 同じパスワードチェック
    if (oldPassword === newPassword) {
      setErrorMessage('新しいパスワードは現在のパスワードと異なるものを設定してください。');
      return;
    }

    setIsSaving(true);
    
    try {
      // API呼び出し
      await changePassword(oldPassword, newPassword, confirmPassword);

      Alert.alert(
        "✅ 変更完了", 
        "パスワードが正常に変更されました。", 
        [
          { 
            text: "OK", 
            onPress: () => router.back() 
          }
        ]
      );

      // 入力内容をクリア
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

    } catch (error: any) {
      console.error('❌ パスワード変更エラー:', error);
      
      // エラーメッセージの判定
      let message = 'エラーが発生しました。もう一度お試しください。';
      
      if (error.message) {
        if (error.message.includes('old_password') || 
            error.message.includes('現在のパスワード') ||
            error.message.includes('incorrect')) {
          message = '現在のパスワードが正しくありません。';
          setOldPassword(''); // パスワードをクリア
        } else if (error.message.includes('セッション') || error.message.includes('ログイン')) {
          message = 'セッションが切れました。再度ログインしてください。';
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

          <View style={styles.content}>
            {/* アイコン */}
            <View style={styles.iconContainer}>
              <Feather name="lock" size={48} color="#4a90e2" />
            </View>

            <Text style={styles.title}>パスワード変更</Text>

            {/* エラーメッセージ */}
            {errorMessage !== '' && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={20} color="#d32f2f" />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* フォームコンテナ */}
            <View style={styles.formContainer}>
              
              {/* 現在のパスワード */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Feather name="key" size={14} color="#333" /> 現在のパスワード
                </Text>
                
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.input}
                    value={oldPassword}
                    onChangeText={(text) => {
                      setOldPassword(text);
                      setErrorMessage('');
                    }}
                    secureTextEntry={!isOldVisible}
                    placeholder="現在のパスワードを入力"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSaving}
                  />
                  <TouchableOpacity
                    style={styles.toggleButton}
                    onPress={() => setIsOldVisible(!isOldVisible)}
                    activeOpacity={0.7}
                  >
                    <Feather 
                      name={isOldVisible ? "eye" : "eye-off"} 
                      size={20} 
                      color="#555" 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* 新しいパスワード */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Feather name="shield" size={14} color="#333" /> 新しいパスワード
                </Text>
                <Text style={styles.hint}>8文字以上で設定してください</Text>
                
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={(text) => {
                      setNewPassword(text);
                      setErrorMessage('');
                    }}
                    secureTextEntry={!isNewVisible}
                    placeholder="新しいパスワードを入力"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSaving}
                  />
                  <TouchableOpacity
                    style={styles.toggleButton}
                    onPress={() => setIsNewVisible(!isNewVisible)}
                    activeOpacity={0.7}
                  >
                    <Feather 
                      name={isNewVisible ? "eye" : "eye-off"} 
                      size={20} 
                      color="#555" 
                    />
                  </TouchableOpacity>
                </View>

                {/* パスワード強度インジケーター */}
                {newPassword.length > 0 && (
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthBar}>
                      <View 
                        style={[
                          styles.strengthFill,
                          { 
                            width: passwordStrength === 'strong' ? '100%' : 
                                   passwordStrength === 'medium' ? '66%' : '33%',
                            backgroundColor: getStrengthColor(passwordStrength)
                          }
                        ]} 
                      />
                    </View>
                    <Text style={[styles.strengthText, { color: getStrengthColor(passwordStrength) }]}>
                      強度: {getStrengthText(passwordStrength)}
                    </Text>
                  </View>
                )}
              </View>

              {/* 確認パスワード */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>
                  <Feather name="check-circle" size={14} color="#333" /> 確認パスワード
                </Text>
                <Text style={styles.hint}>もう一度同じパスワードを入力してください</Text>

                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={(text) => {
                      setConfirmPassword(text);
                      setErrorMessage('');
                    }}
                    secureTextEntry={!isConfirmVisible}
                    placeholder="確認用パスワードを入力"
                    placeholderTextColor="#999"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isSaving}
                  />
                  <TouchableOpacity
                    style={styles.toggleButton}
                    onPress={() => setIsConfirmVisible(!isConfirmVisible)}
                    activeOpacity={0.7}
                  >
                    <Feather 
                      name={isConfirmVisible ? "eye" : "eye-off"} 
                      size={20} 
                      color="#555" 
                    />
                  </TouchableOpacity>
                </View>

                {/* 一致確認インジケーター */}
                {confirmPassword.length > 0 && (
                  <View style={styles.matchIndicator}>
                    {newPassword === confirmPassword ? (
                      <>
                        <Feather name="check" size={16} color="#4caf50" />
                        <Text style={[styles.matchText, { color: '#4caf50' }]}>
                          パスワードが一致しています
                        </Text>
                      </>
                    ) : (
                      <>
                        <Feather name="x" size={16} color="#f44336" />
                        <Text style={[styles.matchText, { color: '#f44336' }]}>
                          パスワードが一致しません
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </View>

              {/* 変更ボタン */}
              <TouchableOpacity
                style={[
                  styles.changeButton,
                  (isSaving || !oldPassword || !newPassword || !confirmPassword) && styles.disabledButton
                ]}
                onPress={handleChange}
                disabled={isSaving || !oldPassword || !newPassword || !confirmPassword}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.changeButtonText}>変更中...</Text>
                  </View>
                ) : (
                  <Text style={styles.changeButtonText}>🔒 パスワードを変更</Text>
                )}
              </TouchableOpacity>

            </View>

            {/* セキュリティ情報 */}
            <View style={styles.securityInfo}>
              <Feather name="info" size={18} color="#1976d2" />
              <View style={styles.securityTextContainer}>
                <Text style={styles.securityTitle}>安全なパスワードのために</Text>
                <Text style={styles.securityText}>
                  • 8文字以上を推奨{'\n'}
                  • 大文字・小文字・数字・記号を組み合わせる{'\n'}
                  • 他のサービスと同じパスワードは使用しない
                </Text>
              </View>
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
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    width: '100%',
    alignItems: 'flex-start',
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
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  content: {
    width: '100%',
    maxWidth: 500,
    alignItems: 'center',
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
    width: '100%',
    textAlign: 'center',
    color: '#1a1a1a',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  errorBox: {
    width: '100%',
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
  formContainer: {
    backgroundColor: 'white',
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginBottom: 6,
  },
  hint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    width: '100%',
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 50,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#1a1a1a',
  },
  toggleButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  strengthContainer: {
    marginTop: 8,
  },
  strengthBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  matchText: {
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '600',
  },
  changeButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignSelf: 'center',
    marginTop: 10,
    minWidth: 200,
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
  changeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  securityInfo: {
    width: '100%',
    flexDirection: 'row',
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
    borderRadius: 8,
    padding: 16,
    marginTop: 24,
  },
  securityTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0d47a1',
    marginBottom: 8,
  },
  securityText: {
    fontSize: 14,
    color: '#0d47a1',
    lineHeight: 22,
  },
});