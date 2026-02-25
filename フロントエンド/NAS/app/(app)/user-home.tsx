import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import AppHeader from '../../components/AppHeader';
import SideMenu from '../../components/SideMenu';

// @ts-ignore
import { getTokens, getUserInfo, logout, postHealthData } from '../../api/apiService';
import { useBLE } from '../../context/BLEContext';
import SensorDataManager from '../../services/SensorDataManager';

// =====================
// マスコットコンポーネント
// =====================
const MascotCharacter: React.FC<{ size?: number }> = ({ size = 100 }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -8, duration: 1200, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, { toValue: 1.05, duration: 1400, useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: -1, duration: 1800, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-3deg', '3deg'],
  });

  return (
    <Animated.Image
      source={require('../../assets/images/mascot.png')}
      style={{
        width: size,
        height: size,
        resizeMode: 'contain',
        transform: [
          { translateY: floatAnim },
          { scale: scaleAnim },
          { rotate },
        ],
      }}
    />
  );
};

// =====================
// 心拍数コメント
// =====================
const getHeartRateComment = (heartRate: number | null | undefined): { comment: string; color: string; emoji: string } => {
  if (!heartRate) {
    return { comment: 'センサーを装着してね！', color: '#999', emoji: '🔍' };
  }
  if (heartRate < 50) {
    return { comment: 'ゆっくり休んでいるね。おやすみ～', color: '#5b8dee', emoji: '😴' };
  }
  if (heartRate < 60) {
    return { comment: 'とても落ち着いているよ！', color: '#4CAF50', emoji: '😌' };
  }
  if (heartRate < 80) {
    return { comment: '心拍数は正常だよ！今日も元気！', color: '#27ae60', emoji: '😊' };
  }
  if (heartRate < 100) {
    return { comment: 'ちょっと活発かな？いい感じ！', color: '#f39c12', emoji: '🙂' };
  }
  if (heartRate < 120) {
    return { comment: '運動中かな？頑張ってるね！', color: '#e67e22', emoji: '💪' };
  }
  if (heartRate < 150) {
    return { comment: '心拍数が高めだよ。少し休もうか？', color: '#e74c3c', emoji: '😰' };
  }
  return { comment: '心拍数がとても高いよ！休んでね！', color: '#c0392b', emoji: '🚨' };
};

// =====================
// マスコット＋吹き出しカード
// =====================
const MascotCard: React.FC<{ heartRate?: number | null; userName: string }> = ({ heartRate, userName }) => {
  const { comment, color, emoji } = getHeartRateComment(heartRate);

  return (
    <View style={mascotCardStyles.container}>
      {/* 吹き出し */}
      <View style={mascotCardStyles.balloonWrapper}>
        <View style={[mascotCardStyles.balloon, { borderColor: color }]}>
          <Text style={mascotCardStyles.greeting}>
            {userName}さん、こんにちは！
          </Text>
          <Text style={[mascotCardStyles.comment, { color }]}>
            {emoji} {comment}
          </Text>
        </View>
        {/* 吹き出しの三角 */}
        <View style={[mascotCardStyles.balloonTail, { borderTopColor: color }]} />
      </View>

      {/* マスコット */}
      <MascotCharacter size={100} />
    </View>
  );
};

const mascotCardStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  balloonWrapper: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 8,
  },
  balloon: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 2,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  balloonTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 0,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginRight: 20,
  },
  greeting: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  comment: {
    fontSize: 15,
    fontWeight: 'bold',
    lineHeight: 22,
  },
});

// =====================
// メイン画面
// =====================
export default function UserHomeScreen() {
  const [menuVisible, setMenuVisible] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const router = useRouter();

  const { isConnected, connectedDevice, lastReceivedData, debugLogs } = useBLE();

  const [showDebug, setShowDebug] = useState(true);
  const [unsentStatus, setUnsentStatus] = useState<string>('');
  const [isSendingUnsent, setIsSendingUnsent] = useState(false);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  useEffect(() => {
    checkAndSendUnsentData();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const data = await getUserInfo();
      setUserInfo(data);
      setHasError(false);
    } catch (error: any) {
      setHasError(true);
      if (
        error.message?.includes('セッション') ||
        error.message?.includes('ログイン') ||
        error.message?.includes('認証')
      ) {
        Alert.alert(
          '⚠️ セッション切れ',
          'セッションが切れました。再度ログインしてください。',
          [{ text: 'OK', onPress: async () => { await logout(); router.replace('/(auth)'); } }],
          { cancelable: false }
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkAndSendUnsentData = async () => {
    if (isSendingUnsent) return;
    setIsSendingUnsent(true);
    try {
      const unsentCount = await SensorDataManager.getUnsentDataCount();
      if (unsentCount > 0) {
        setUnsentStatus(`${unsentCount}件のデータを送信中...`);
        const result = await SensorDataManager.checkAndResendUnsentData();
        if (result.success && result.successCount && result.successCount > 0) {
          setUnsentStatus(`${result.successCount}件のデータを送信しました ✓`);
          setTimeout(() => setUnsentStatus(''), 3000);
        } else {
          setUnsentStatus('');
        }
      }
    } catch {
      setUnsentStatus('');
    } finally {
      setIsSendingUnsent(false);
    }
  };

  const checkUnsentDataDetails = async () => {
    try {
      const storedJson = await AsyncStorage.getItem('sensorDataStore');
      if (!storedJson) {
        Alert.alert('確認', 'AsyncStorageにデータがありません');
        return;
      }
      const dataStore = JSON.parse(storedJson);
      const unsentData = dataStore.filter((d: any) => !d.sent);
      if (unsentData.length === 0) {
        Alert.alert('確認', `総データ: ${dataStore.length}件\n未送信: 0件\n\n✅ 全てのデータが送信済みです`);
        return;
      }
      const firstUnsent = unsentData[0];
      let displayDate = '不明';
      try {
        const date = new Date(firstUnsent.datetime || firstUnsent.timestamp);
        if (!isNaN(date.getTime())) {
          displayDate = date.toLocaleString('ja-JP');
        }
      } catch {}
      const { accessToken } = await getTokens();
      Alert.alert(
        '未送信データ詳細',
        `総データ: ${dataStore.length}件\n未送信: ${unsentData.length}件\n\n時刻: ${displayDate}\n心拍: ${firstUnsent.heartRate || '不明'} bpm\n体温: ${firstUnsent.temperature || '不明'}°C\nトークン: ${accessToken ? '✅ あり' : '❌ なし'}`,
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: '今すぐ送信テスト', onPress: () => testSendFirstData(firstUnsent) }
        ]
      );
    } catch (error: any) {
      Alert.alert('エラー', error.message);
    }
  };

  const testSendFirstData = async (data: any) => {
    try {
      const healthData = {
        measured_at: new Date(data.timestamp).toISOString(),
        body: data.temperature,
        heart_rate: data.heartRate,
      };
      const result = await postHealthData(healthData);
      Alert.alert('✅ 送信成功', `レスポンス:\n${JSON.stringify(result, null, 2)}`);
      const storedJson = await AsyncStorage.getItem('sensorDataStore');
      if (storedJson) {
        const dataStore = JSON.parse(storedJson);
        const target = dataStore.find((d: any) => d.id === data.id);
        if (target) { target.sent = true; await AsyncStorage.setItem('sensorDataStore', JSON.stringify(dataStore)); }
      }
    } catch (error: any) {
      Alert.alert('❌ 送信失敗', error.message);
    }
  };

  const createTestData = async () => {
    try {
      const now = new Date();
      const testData = {
        id: `test_${Date.now()}`,
        datetime: now.toISOString(),
        heartRate: 75,
        temperature: 36.5,
        movement: 0.5,
        timestamp: now.toISOString(),
        sent: false,
        rawData: 'test',
        hourKey: now.toISOString().slice(0, 13),
      };
      const storedJson = await AsyncStorage.getItem('sensorDataStore');
      const dataStore = storedJson ? JSON.parse(storedJson) : [];
      dataStore.push(testData);
      await AsyncStorage.setItem('sensorDataStore', JSON.stringify(dataStore));
      Alert.alert('成功', 'テストデータを作成しました！');
    } catch (error) {
      Alert.alert('エラー', String(error));
    }
  };

  const clearStorage = () => {
    Alert.alert('確認', '全てのデータを削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: async () => { await AsyncStorage.removeItem('sensorDataStore'); Alert.alert('完了', 'データを削除しました'); } }
    ]);
  };

  const getUserDisplayName = () => {
    if (!userInfo) return 'ゲスト';
    if (userInfo.username) return userInfo.username;
    if (userInfo.email) return userInfo.email;
    return 'ユーザー';
  };

  const handleRetry = () => {
    setIsLoading(true);
    setHasError(false);
    fetchUserInfo();
  };

  const ConnectionStatusBadge = () => (
    <View style={styles.connectionBadge}>
      <Feather name="bluetooth" size={14} color={isConnected ? '#4a90e2' : '#999'} />
      <Text style={[styles.connectionText, { color: isConnected ? '#4a90e2' : '#999' }]}>
        {isConnected ? `${connectedDevice?.name || 'デバイス'} 接続中` : 'デバイス未接続'}
      </Text>
    </View>
  );

  if (hasError && !isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <AppHeader title="ホーム" showMenu showNotification onMenuPress={() => setMenuVisible(true)} onNotificationPress={() => {}} />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={64} color="#e74c3c" />
          <Text style={styles.errorText}>データの取得に失敗しました</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>再試行</Text>
          </TouchableOpacity>
        </View>
        <SideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} userInfo={userInfo} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader title="ホーム" showMenu showNotification onMenuPress={() => setMenuVisible(true)} onNotificationPress={() => {}} />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>読み込み中...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content}>
          {unsentStatus !== '' && (
            <View style={styles.unsentStatusBar}>
              {isSendingUnsent && <ActivityIndicator size="small" color="#007AFF" style={styles.statusSpinner} />}
              <Text style={styles.unsentStatusText}>{unsentStatus}</Text>
            </View>
          )}

          {/* デバッグツールバー */}
          <View style={styles.debugToolbar}>
            <TouchableOpacity style={styles.debugToolButton} onPress={checkUnsentDataDetails}>
              <Ionicons name="search" size={16} color="#fff" />
              <Text style={styles.debugToolButtonText}>未送信データ確認</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.debugToolButton, { backgroundColor: '#28a745' }]} onPress={createTestData}>
              <Ionicons name="add-circle" size={16} color="#fff" />
              <Text style={styles.debugToolButtonText}>テストデータ作成</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.debugToolButton, { backgroundColor: '#dc3545' }]} onPress={clearStorage}>
              <Ionicons name="trash" size={16} color="#fff" />
              <Text style={styles.debugToolButtonText}>データ削除</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.badgeContainer}>
            <ConnectionStatusBadge />
          </View>

          {/* ✅ マスコット＋吹き出しカード */}
          <MascotCard
            heartRate={lastReceivedData?.heartRate}
            userName={getUserDisplayName()}
          />

          {/* ウェルカム */}
          <View style={styles.welcomeContainer}>
            <Text style={styles.welcomeText}>ようこそ！</Text>
            <Text style={styles.subText}>{getUserDisplayName()}さん</Text>
            <Text style={styles.dateText}>
              {new Date().toLocaleDateString('ja-JP', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
              })}
            </Text>
          </View>

          {userInfo && (
            <View style={styles.statsContainer}>
              <View style={styles.statCard}>
                <Ionicons name="heart" size={24} color="#e74c3c" />
                <Text style={styles.statLabel}>心拍</Text>
                <Text style={styles.statValue}>
                  {lastReceivedData?.heartRate ? `${lastReceivedData.heartRate} bpm` : '--'}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="thermometer" size={24} color="#3498db" />
                <Text style={styles.statLabel}>体温</Text>
                <Text style={styles.statValue}>
                  {lastReceivedData?.temperature ? `${lastReceivedData.temperature.toFixed(1)}°C` : '--'}
                </Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="walk" size={24} color="#9b59b6" />
                <Text style={styles.statLabel}>動き</Text>
                <Text style={styles.statValue}>
                  {lastReceivedData?.movement ? lastReceivedData.movement.toFixed(2) : '--'}
                </Text>
              </View>
            </View>
          )}

          {showDebug && (
            <View style={styles.debugCard}>
              <View style={styles.debugHeader}>
                <Text style={styles.debugTitle}>🔧 デバッグ情報</Text>
                <TouchableOpacity onPress={() => setShowDebug(false)}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
              <View style={styles.debugContent}>
                <Text style={styles.debugLabel}>接続状態:</Text>
                <Text style={styles.debugValue}>{isConnected ? '✅ 接続中' : '❌ 未接続'}</Text>
                <Text style={styles.debugLabel}>デバイス名:</Text>
                <Text style={styles.debugValue}>{connectedDevice?.name || '---'}</Text>
                <Text style={styles.debugLabel}>最終受信時刻:</Text>
                <Text style={styles.debugValue}>{lastReceivedData?.datetime || '---'}</Text>
                <Text style={styles.debugLabel}>心拍数:</Text>
                <Text style={styles.debugValue}>{lastReceivedData?.heartRate || '---'}</Text>
                <Text style={styles.debugLabel}>体温:</Text>
                <Text style={styles.debugValue}>{lastReceivedData?.temperature || '---'}</Text>
                <Text style={styles.debugLabel}>動き:</Text>
                <Text style={styles.debugValue}>{lastReceivedData?.movement || '---'}</Text>
                <View style={styles.debugSeparator} />
                <Text style={styles.debugLabel}>ログ記録数:</Text>
                <Text style={styles.debugValue}>{debugLogs?.length || 0} 件</Text>
                {debugLogs && debugLogs.length > 0 && (
                  <>
                    <Text style={styles.debugLabel}>最新ログ:</Text>
                    <Text style={styles.debugValue}>{debugLogs[debugLogs.length - 1]?.message?.substring(0, 40) || '---'}</Text>
                  </>
                )}
              </View>
              <TouchableOpacity style={styles.viewLogsButton} onPress={() => router.push('/(app)/debug-log')}>
                <Ionicons name="list" size={16} color="#fff" />
                <Text style={styles.viewLogsButtonText}>詳細ログを表示</Text>
              </TouchableOpacity>
            </View>
          )}

          {!showDebug && (
            <TouchableOpacity style={styles.showDebugButton} onPress={() => setShowDebug(true)}>
              <Text style={styles.showDebugText}>🔧 デバッグ情報を表示</Text>
            </TouchableOpacity>
          )}

          <View style={styles.menuSection}>
            <Text style={styles.sectionTitle}>📋 メニュー</Text>
            <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/(app)/user-info')} activeOpacity={0.7}>
              <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="person-outline" size={32} color="#4CAF50" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>利用者情報</Text>
                <Text style={styles.menuDescription}>プロフィール設定・身長・体重など</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/(app)/explore')} activeOpacity={0.7}>
              <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="bar-chart-outline" size={32} color="#2196F3" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>グラフ</Text>
                <Text style={styles.menuDescription}>心拍・体温・睡眠データの確認</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCard} onPress={() => router.push('/(app)/help')} activeOpacity={0.7}>
              <View style={[styles.iconContainer, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="help-circle-outline" size={32} color="#FF9800" />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>ヘルプ</Text>
                <Text style={styles.menuDescription}>チャットボット・お問い合わせ</Text>
              </View>
              <Ionicons name="chevron-forward" size={24} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.noticeSection}>
            <Text style={styles.sectionTitle}>📢 お知らせ</Text>
            <View style={styles.noticeCard}>
              <View style={styles.noticeIconContainer}>
                <Ionicons name="information-circle" size={24} color="#4a90e2" />
              </View>
              <View style={styles.noticeContent}>
                <Text style={styles.noticeTitle}>健康管理のお知らせ</Text>
                <Text style={styles.noticeText}>定期的な健康チェックを行いましょう</Text>
              </View>
            </View>
          </View>

          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>NASシステム v1.0.0</Text>
          </View>
        </ScrollView>
      )}

      <TouchableOpacity style={styles.floatingDebugButton} onPress={() => router.push('/(app)/debug-log')} activeOpacity={0.8}>
        <Ionicons name="bug" size={24} color="#fff" />
        {debugLogs && debugLogs.length > 0 && (
          <View style={styles.logBadge}>
            <Text style={styles.logBadgeText}>{debugLogs.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <SideMenu visible={menuVisible} onClose={() => setMenuVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F5F5F5' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 60 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { fontSize: 18, color: '#666', marginTop: 20, marginBottom: 30, textAlign: 'center' },
  retryButton: { backgroundColor: '#4a90e2', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  content: { flex: 1 },
  unsentStatusBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F2FD', paddingVertical: 12, paddingHorizontal: 16, marginHorizontal: 16, marginTop: 12, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#1976D2' },
  statusSpinner: { marginRight: 8 },
  unsentStatusText: { color: '#1976D2', fontSize: 14, fontWeight: '600' },
  debugToolbar: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 12, marginBottom: 8, gap: 8 },
  debugToolButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 8, gap: 4 },
  debugToolButtonText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  badgeContainer: { paddingHorizontal: 16, paddingTop: 12, alignItems: 'flex-end' },
  connectionBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e0e0e0' },
  connectionText: { fontSize: 12, fontWeight: '600' },
  welcomeContainer: { backgroundColor: 'white', padding: 24, marginBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  welcomeText: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  subText: { fontSize: 18, color: '#666', marginBottom: 8, fontWeight: '600' },
  dateText: { fontSize: 14, color: '#999' },
  statsContainer: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 16, gap: 12 },
  statCard: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  statLabel: { fontSize: 12, color: '#666', marginTop: 8, marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  debugCard: { backgroundColor: '#1a1a1a', marginHorizontal: 16, marginBottom: 16, borderRadius: 12, padding: 16, borderWidth: 2, borderColor: '#4a90e2' },
  debugHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#333' },
  debugTitle: { fontSize: 16, fontWeight: 'bold', color: '#4a90e2' },
  debugContent: { gap: 8 },
  debugLabel: { fontSize: 12, color: '#999', marginTop: 4 },
  debugValue: { fontSize: 14, color: '#0f0', fontFamily: 'monospace', marginLeft: 8 },
  debugSeparator: { height: 1, backgroundColor: '#333', marginVertical: 8 },
  viewLogsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4a90e2', marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, gap: 8 },
  viewLogsButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  showDebugButton: { backgroundColor: '#1a1a1a', marginHorizontal: 16, marginBottom: 16, padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#4a90e2' },
  showDebugText: { color: '#4a90e2', fontSize: 14, fontWeight: '600' },
  menuSection: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12, marginTop: 8 },
  menuCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  iconContainer: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  menuContent: { flex: 1 },
  menuTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  menuDescription: { fontSize: 13, color: '#666', lineHeight: 18 },
  noticeSection: { paddingHorizontal: 16, marginBottom: 24 },
  noticeCard: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#E3F2FD', padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#4a90e2' },
  noticeIconContainer: { marginRight: 12, marginTop: 2 },
  noticeContent: { flex: 1 },
  noticeTitle: { fontSize: 15, fontWeight: 'bold', color: '#1976d2', marginBottom: 4 },
  noticeText: { fontSize: 14, color: '#333', lineHeight: 20 },
  versionContainer: { alignItems: 'center', paddingVertical: 20, marginBottom: 80 },
  versionText: { fontSize: 12, color: '#999' },
  floatingDebugButton: { position: 'absolute', bottom: 24, right: 24, width: 60, height: 60, backgroundColor: '#2196F3', borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
  logBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#F44336', borderRadius: 12, minWidth: 24, height: 24, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
  logBadgeText: { color: '#fff', fontSize: 11, fontWeight: 'bold', paddingHorizontal: 4 },
});