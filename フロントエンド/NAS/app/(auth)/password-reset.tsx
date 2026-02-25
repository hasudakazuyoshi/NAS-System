// app/(auth)/password-reset.tsx

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// ✅ apiServiceをインポート
import { requestPasswordReset } from '../../api/apiService';

export default function PasswordResetScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  // ✅ apiServiceを使用したAPI呼び出し
  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert("エラー", "メールアドレスを入力してください");
      return;
    }

    // 簡単なメールバリデーション
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("エラー", "有効なメールアドレスを入力してください");
      return;
    }

    setIsLoading(true);

    try {
      console.log('📤 パスワードリセットメール送信');
      console.log('📧 メールアドレス:', email);

      // ✅ apiServiceを使用
      const data = await requestPasswordReset(email);

      console.log('✅ メール送信成功:', data);
      setIsSent(true);

    } catch (error: any) {
      console.error('❌ パスワードリセットエラー:', error);
      
      // エラーメッセージの判定
      let errorMessage = '通信エラーが発生しました';
      
      if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert('エラー', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // 戻るボタン
  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.innerContainer}
      >
        {/* 戻るボタン */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#666" />
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>
        </View>

        {/* コンテンツ */}
        <View style={styles.content}>
          <Text style={styles.title}>パスワードリセット</Text>

          {isSent ? (
            // 送信完了画面
            <View style={styles.successBox}>
              <Feather name="check-circle" size={48} color="#4CAF50" style={{ marginBottom: 16 }} />
              <Text style={styles.successTitle}>メールを送信しました</Text>
              <Text style={styles.successText}>
                {email} 宛に再設定リンクをお送りしました。{'\n'}
                メールボックスをご確認ください。
              </Text>
              <TouchableOpacity onPress={() => setIsSent(false)}>
                <Text style={styles.retryLink}>メールアドレスを再入力する</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // 入力フォーム
            <View style={styles.form}>
              <Text style={styles.label}>登録済みメールアドレス</Text>
              
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="example@email.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />

              <TouchableOpacity 
                style={[styles.submitButton, isLoading && styles.disabledButton]} 
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitButtonText}>リセットメールを送信</Text>
                )}
              </TouchableOpacity>

              <Text style={styles.description}>
                入力したメールアドレス宛にパスワード再設定用のリンクを送信します。{'\n'}
                メール内のリンクをタップして、新しいパスワードを設定してください。
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF5EC' },
  innerContainer: { flex: 1, paddingHorizontal: 20 },
  header: { marginTop: 20, marginBottom: 40, alignItems: 'flex-start' },
  backButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#FFF', 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#EEE', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 1 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 2, 
    elevation: 2 
  },
  backButtonText: { marginLeft: 8, fontSize: 14, color: '#666', fontWeight: '600' },
  content: { flex: 1, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#FFAB76', marginBottom: 40, letterSpacing: 1 },
  form: { width: '100%' },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  input: { 
    backgroundColor: '#FFF', 
    borderWidth: 1, 
    borderColor: '#DDD', 
    borderRadius: 8, 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    fontSize: 16, 
    marginBottom: 24 
  },
  submitButton: { 
    backgroundColor: '#F4A460', 
    borderRadius: 8, 
    paddingVertical: 14, 
    alignItems: 'center', 
    marginBottom: 24, 
    shadowColor: '#F4A460', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 4, 
    elevation: 4 
  },
  disabledButton: { backgroundColor: '#E0C0A0' },
  submitButtonText: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  description: { fontSize: 13, color: '#666', lineHeight: 20 },
  successBox: { 
    backgroundColor: '#FFF', 
    padding: 24, 
    borderRadius: 12, 
    width: '100%', 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 4, 
    elevation: 3 
  },
  successTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  successText: { 
    fontSize: 14, 
    color: '#666', 
    textAlign: 'center', 
    marginBottom: 20, 
    lineHeight: 20 
  },
  retryLink: { color: '#F4A460', fontWeight: '600' }
});
