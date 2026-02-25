
import { Feather } from '@expo/vector-icons';
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

// 🔥 修正：正しいインポート
import { preRegister } from '../api/apiService';

export default function IdentityVerificationCompleteScreen(): React.JSX.Element {
  const params = useLocalSearchParams();
  const router = useRouter();
  
  // 前の画面から受け取ったメールアドレス
  const userEmail = (params.email as string) || 'user-example@mail.com';
  
  const [isLoading, setIsLoading] = useState(false);

  // 🔥 修正：再送信処理
  const handleResend = async (): Promise<void> => {
    setIsLoading(true);
    try {
      console.log('🔄 確認メール再送信:', userEmail);
      
      // 🔥 preRegisterを使用（再度仮登録を実行）
      const data = await preRegister(userEmail);
      
      if (data.success) {
        Alert.alert(
          "✅ 送信完了",
          "確認メールを再送信しました。\nメールボックスをご確認ください。",
          [{ text: 'OK' }]
        );
      } else {
        throw new Error(data.error || '再送信に失敗しました');
      }
      
    } catch (error: any) {
      console.error("❌ 再送信エラー:", error);
      
      let errorMessage = "送信できませんでした。";
      if (error.message) {
        errorMessage = error.message;
      }
      
      Alert.alert("送信エラー", errorMessage, [{ text: 'OK' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // インデックス画面（ログイン画面）へ戻る
  const handleBackToIndex = () => {
    router.replace('/(auth)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        
        {/* 成功アイコン */}
        <View style={styles.iconContainer}>
          <View style={styles.checkCircle}>
            <Feather name="check" size={60} color="#27ae60" />
          </View>
        </View>

        {/* メッセージコンテナ */}
        <View style={styles.messageContainer}>
          <Text style={styles.mainMessage}>仮登録が完了しました</Text>
          
          <Text style={styles.subMessage}>
            メールアプリを開き本人確認を{'\n'}
            行ってください
          </Text>
        </View>

        {/* メールアドレス表示カード */}
        <View style={styles.emailCard}>
          <Feather name="mail" size={20} color="#666" />
          <View style={styles.emailTextContainer}>
            <Text style={styles.emailLabel}>送信先</Text>
            <Text style={styles.emailAddress}>{userEmail}</Text>
          </View>
        </View>

        {/* 注意事項 */}
        <View style={styles.noticeContainer}>
          <Feather name="info" size={18} color="#1976d2" />
          <Text style={styles.noticeText}>
            メールが届かない場合は、迷惑メールフォルダをご確認ください
          </Text>
        </View>

        {/* 再送信ボタン */}
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
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.resendButtonTextLoading}>送信中...</Text>
              </View>
            ) : (
              <>
                <Feather name="rotate-cw" size={18} color="#fff" />
                <Text style={styles.resendButtonText}>確認メールを再送信</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* インデックス画面へ戻るボタン */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBackToIndex}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={18} color="#666" />
          <Text style={styles.backButtonText}>ログイン画面へ戻る</Text>
        </TouchableOpacity>
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
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  checkCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#d4edda',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#27ae60',
    ...Platform.select({
      ios: {
        shadowColor: '#27ae60',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  messageContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  mainMessage: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  subMessage: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
    lineHeight: 28,
  },
  emailCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
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
  emailTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  emailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  emailAddress: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  noticeContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#1976d2',
    borderRadius: 8,
    padding: 16,
    marginBottom: 32,
  },
  noticeText: {
    flex: 1,
    fontSize: 14,
    color: '#0d47a1',
    marginLeft: 12,
    lineHeight: 20,
  },
  resendContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  resendLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff9800',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    minWidth: 220,
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#ff9800',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  resendButtonDisabled: {
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
  resendButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  resendButtonTextLoading: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 8,
  },
});