import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// @ts-ignore
import { deleteAccount } from '../api/apiService';
import { useAuth } from '../context/AuthContext'; // ← 追加

interface SideMenuProps {
  visible: boolean;
  onClose: () => void;
  userInfo?: any;
}

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route?: string;
  action?: () => void;
  color?: string;
  isDanger?: boolean;
}

export default function SideMenu({ visible, onClose, userInfo }: SideMenuProps) {
  const router = useRouter();
  const { logout: authLogout } = useAuth(); // ← 追加

  const navigateTo = (path: string) => {
    onClose();
    setTimeout(() => {
      router.push(path as any);
    }, 300);
  };

  const handleLogout = async () => {
    Alert.alert(
      'ログアウト',
      'ログアウトしますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'ログアウト',
          style: 'destructive',
          onPress: async () => {
            try {
              onClose();
              console.log('🔓 ログアウト処理開始...');
              
              // ✅ AuthContextのlogout関数を使用
              await authLogout();
              
              console.log('✅ ログアウト完了');
              router.replace('/(auth)');
            } catch (error) {
              console.error('❌ ログアウトエラー:', error);
              // エラーでもログイン画面に遷移
              router.replace('/(auth)');
            }
          }
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ 退会確認',
      'アカウントを削除すると、すべてのデータ（健康データ、睡眠データ、お問い合わせ履歴など）が完全に削除されます。\n\nこの操作は取り消せません。本当に退会しますか？',
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '退会する',
          style: 'destructive',
          onPress: async () => {
            try {
              onClose();
              
              console.log('🗑️ 退会処理開始...');
              await deleteAccount();
              console.log('✅ 退会処理完了');
              
              // ✅ 退会後もAuthContextのlogoutを呼び出して認証状態をクリア
              await authLogout();
              
              Alert.alert(
                '✅ 退会完了', 
                'アカウントを削除しました。ご利用ありがとうございました。',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      router.replace('/(auth)');
                    }
                  }
                ]
              );
              
            } catch (error: any) {
              console.error('❌ 退会エラー:', error);
              
              let errorMessage = '退会処理に失敗しました。';
              if (error.message) {
                errorMessage = error.message;
              }
              
              Alert.alert('エラー', errorMessage);
            }
          }
        }
      ]
    );
  };

  // 表示用のユーザー名取得
  const getUserDisplayName = () => {
    if (!userInfo) return 'ゲスト';
    return userInfo.username || userInfo.email || 'ユーザー';
  };

  // 表示用のメールアドレス取得
  const getUserEmail = () => {
    if (!userInfo) return '';
    return userInfo.email || '';
  };

  const menuItems: MenuItem[] = [
    { icon: 'home-outline', label: 'ホーム', route: '/(app)/user-home' },
    { icon: 'person-outline', label: '利用者情報', route: '/(app)/user-info' },
    { icon: 'bar-chart-outline', label: 'グラフ', route: '/(app)/explore' },
    { icon: 'help-circle-outline', label: 'ヘルプ', route: '/(app)/help' },
  ];

  const actionItems: MenuItem[] = [
    { 
      icon: 'log-out-outline', 
      label: 'ログアウト', 
      action: handleLogout,
      color: '#FF9500',
      isDanger: false
    },
    { 
      icon: 'person-remove-outline', 
      label: '退会', 
      action: handleDeleteAccount,
      color: '#FF3B30',
      isDanger: true
    },
  ];

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          activeOpacity={1}
          style={styles.sideMenu}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* ユーザーヘッダー */}
            <View style={styles.menuHeader}>
              <View style={styles.userIconContainer}>
                <Ionicons name="person-circle-outline" size={60} color="#4a90e2" />
              </View>
              <Text style={styles.userName}>{getUserDisplayName()}</Text>
              <Text style={styles.userEmail}>{getUserEmail()}</Text>
            </View>

            {/* メニュー項目 */}
            <View style={styles.menuItemsContainer}>
              <Text style={styles.sectionTitle}>メニュー</Text>
              {menuItems.map((item, index) => (
                <TouchableOpacity 
                  key={index}
                  style={styles.menuItem}
                  onPress={() => item.route && navigateTo(item.route)}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={item.icon} 
                    size={22} 
                    color={item.color || '#333'} 
                  />
                  <Text style={styles.menuText}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={20} color="#999" />
                </TouchableOpacity>
              ))}
            </View>

            {/* アクション項目 */}
            <View style={styles.actionItemsContainer}>
              <Text style={styles.sectionTitle}>アカウント</Text>
              {actionItems.map((item, index) => (
                <TouchableOpacity 
                  key={index}
                  style={[
                    styles.menuItem,
                    item.isDanger && styles.dangerMenuItem
                  ]}
                  onPress={item.action}
                  activeOpacity={0.7}
                >
                  <Ionicons 
                    name={item.icon} 
                    size={22} 
                    color={item.color || '#333'} 
                  />
                  <Text 
                    style={[
                      styles.menuText,
                      { color: item.color || '#333' }
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Ionicons 
                    name="chevron-forward" 
                    size={20} 
                    color={item.color || '#999'} 
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* フッター */}
            <View style={styles.menuFooter}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.closeText}>閉じる</Text>
              </TouchableOpacity>
              
              {/* バージョン情報 */}
              <Text style={styles.versionText}>NASシステム v1.0.0</Text>
            </View>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-start',
  },
  sideMenu: {
    width: '80%',
    maxWidth: 320,
    height: '100%',
    backgroundColor: 'white',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  menuHeader: {
    backgroundColor: '#f8f9fa',
    paddingVertical: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  userIconContainer: {
    marginBottom: 10,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
  },
  menuItemsContainer: {
    paddingVertical: 10,
  },
  actionItemsContainer: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    paddingHorizontal: 20,
    paddingVertical: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  dangerMenuItem: {
    backgroundColor: '#FFF5F5',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 15,
    color: '#333',
  },
  menuFooter: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  closeButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  closeText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});