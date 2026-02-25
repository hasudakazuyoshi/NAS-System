import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { preRegister } from '../api/apiService';

export default function RegisterScreen() {
  const router = useRouter();
  
  const [email, setEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleRegister = async (): Promise<void> => {
    if (!email.trim()) {
      Alert.alert('入力エラー', 'メールアドレスを入力してください。');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('入力エラー', '有効なメールアドレスを入力してください。');
      return;
    }

    setLoading(true);
    try {
      console.log('📧 新規登録試行:', email);
      
      const response = await preRegister(email.trim());
      
      console.log('✅ 仮登録成功:', response);
      
      if (response.success) {
        router.push({
          pathname: '/ProvisionalRegistrationComplete',
          params: { email: email.trim() }
        });
      } else {
        throw new Error(response.error || '登録に失敗しました');
      }
      
    } catch (error: any) {
      console.error('❌ 登録エラー:', error);
      
      let errorMessage = '登録中にエラーが発生しました。';
      
      if (error.message) {
        if (error.message.includes('already exists') || 
            error.message.includes('既に登録') ||
            error.message.includes('duplicate')) {
          errorMessage = 'このメールアドレスは既に登録されています。';
        } else if (error.message.includes('invalid') || 
                   error.message.includes('無効')) {
          errorMessage = 'メールアドレスの形式が正しくありません。';
        } else if (error.message.includes('HTML') || error.message.includes('<')) {
          errorMessage = 'サーバーに接続できません。\nサーバーが起動しているか確認してください。';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('登録失敗', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace('/(auth)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          
          <View style={styles.headerContainer}>
            <Text style={styles.icon}>🍃</Text>
            <Text style={styles.title}>NASシステム</Text>
          </View>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.tabButton, styles.tabButtonLeft]}
              onPress={handleBackToLogin}
              disabled={loading}
              activeOpacity={0.7}
            >
              <Text style={styles.tabButtonText}>ログイン</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, styles.tabButtonActive, styles.tabButtonRight]}
              disabled
            >
              <Text style={[styles.tabButtonText, styles.tabButtonTextActive]}>
                新規利用者登録
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            
            <View style={styles.infoBox}>
              <Feather name="info" size={20} color="#1976d2" />
              <Text style={styles.infoText}>
                メールアドレスを入力すると、確認メールが送信されます。
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>
                <Feather name="mail" size={14} color="#444" /> メールアドレス
              </Text>
              <View style={styles.inputWrapper}>
                <Feather name="at-sign" size={18} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="example@mail.com"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
            </View>
            
            <TouchableOpacity
              style={[
                styles.registerButton, 
                (loading || !email) && styles.registerButtonDisabled
              ]}
              onPress={handleRegister}
              disabled={loading || !email}
              activeOpacity={0.8}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="white" size="small" />
                  <Text style={styles.registerButtonText}>登録中...</Text>
                </View>
              ) : (
                <Text style={styles.registerButtonText}>📧 確認メールを送信</Text>
              )}
            </TouchableOpacity>

            <View style={styles.noticeContainer}>
              <Feather name="alert-circle" size={16} color="#ff9800" />
              <Text style={styles.noticeText}>
                登録後、メールアドレスに確認リンクが送信されます。メールを確認して登録を完了してください。
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fef5e7',
  },
  scrollContainer: {
    flexGrow: 1, 
    justifyContent: 'center',
  },
  container: {
    backgroundColor: '#fef5e7',
    alignItems: 'center',
    padding: 20,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  icon: {
    fontSize: 36,
    marginRight: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 30,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#3498db',
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  tabButtonLeft: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    marginRight: -2,
  },
  tabButtonRight: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#3498db', 
    borderColor: '#3498db',
  },
  tabButtonText: {
    color: '#3498db',
    fontSize: 15,
    fontWeight: 'bold',
  },
  tabButtonTextActive: {
    color: 'white',
  },
  form: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#0d47a1',
    marginLeft: 10,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#444',
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  input: {
    width: '100%',
    height: 48,
    paddingHorizontal: 12,
    paddingLeft: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    fontSize: 15,
    backgroundColor: '#f8f9fa',
    color: '#2c3e50',
  },
  registerButton: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#27ae60',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#27ae60',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  registerButtonDisabled: {
    backgroundColor: '#95a5a6',
    shadowOpacity: 0,
    elevation: 0,
  },
  registerButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noticeContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ff9800',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#856404',
    marginLeft: 8,
    lineHeight: 18,
  },
});