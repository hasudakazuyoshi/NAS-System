import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// @ts-ignore
import { apiCall } from '../api/apiService';

export default function MailSendScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // URLパラメータからメールアドレスを取得（なければデフォルト値）
  const userEmail = (params.email as string) || 'user-example@mail.com';
  
  const [isLoading, setIsLoading] = useState(false);

  // OKボタンを押した時の処理
  const handleOkPress = (): void => {
    if (router.canGoBack()) {
      router.back();
    } else {
      // ログイン画面に戻る（パスは環境に合わせて調整）
      router.replace('/(auth)/index');
    }
  };

  // メール再送信処理
  const handleResend = async (): Promise<void> => {
    setIsLoading(true);

    try {
      await apiCall('/resend-email/', 'POST', {
        email: userEmail,
      }, false);

      Alert.alert(
        "✅ 送信完了",
        "確認メールを再送信しました。\nメールボックスをご確認ください。",
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error("❌ 再送信エラー:", error);
      Alert.alert(
        "送信エラー",
        error.message || "メールの再送信に失敗しました。\nしばらく時間をおいて再度お試しください。",
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* メールアイコン */}
        <View style={styles.iconContainer}>
          <Text style={styles.iconText}>📧</Text>
        </View>

        {/* タイトル */}
        <Text style={styles.title}>メール送信完了</Text>

        {/* 説明テキスト */}
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>
            パスワード再設定用のURLを{'\n'}
            下記メールアドレス宛に送信しました
          </Text>
        </View>

        {/* メールアドレス表示カード */}
        <View style={styles.emailCard}>
          <Text style={styles.emailLabel}>送信先メールアドレス</Text>
          <Text style={styles.emailAddress}>{userEmail}</Text>
        </View>

        {/* 注意事項 */}
        <View style={styles.noticeContainer}>
          <Text style={styles.noticeText}>
            ⚠️ メールが届かない場合は、迷惑メールフォルダをご確認ください
          </Text>
        </View>

        {/* OKボタン */}
        <TouchableOpacity 
          style={styles.okButton} 
          onPress={handleOkPress}
          activeOpacity={0.8}
        >
          <Text style={styles.okButtonText}>OK</Text>
        </TouchableOpacity>

        {/* 再送信リンク */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendLabel}>メールが届かない場合</Text>
          <TouchableOpacity 
            onPress={handleResend} 
            disabled={isLoading}
            style={[
              styles.resendButton,
              isLoading && styles.resendButtonDisabled
            ]}
            activeOpacity={0.7}
          >
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#007bff" />
                <Text style={styles.resendButtonTextLoading}>送信中...</Text>
              </View>
            ) : (
              <Text style={styles.resendButtonText}>🔄 メールを再送信</Text>
            )}
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e3f2fd',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
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
  iconText: {
    fontSize: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  messageContainer: {
    marginBottom: 32,
  },
  messageText: {
    fontSize: 16,
    color: '#555',
    lineHeight: 24,
    textAlign: 'center',
  },
  emailCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
  emailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontWeight: '600',
  },
  emailAddress: {
    fontSize: 18,
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  noticeContainer: {
    width: '100%',
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  noticeText: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
  okButton: {
    width: '100%',
    paddingVertical: 16,
    backgroundColor: '#4a90e2',
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
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
  okButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  resendButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007bff',
    minWidth: 200,
    alignItems: 'center',
  },
  resendButtonDisabled: {
    borderColor: '#ccc',
    opacity: 0.6,
  },
  resendButtonText: {
    fontSize: 16,
    color: '#007bff',
    fontWeight: '600',
  },
  resendButtonTextLoading: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
