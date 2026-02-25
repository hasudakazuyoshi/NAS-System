import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import AppHeader from '../../components/AppHeader';
import { useBLE } from '../../context/BLEContext';
import HeartRateScreen from './HeartRateScreen';
import SleepChartScreen from './SleepChartScreen';

type Tab = 'vitals' | 'sleep';

export default function ExploreScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('vitals');
  
  // ✅ BLEの接続状態のみ取得（表示用）
  const { isConnected, connectedDevice } = useBLE();

  // ✅ シンプルな接続状態バッジ
  const ConnectionStatusBadge = () => (
    <View style={styles.connectionBadge}>
      <Feather 
        name="bluetooth" 
        size={14} 
        color={isConnected ? "#4a90e2" : "#999"} 
      />
      <Text style={[
        styles.connectionText,
        { color: isConnected ? "#4a90e2" : "#999" }
      ]}>
        {isConnected 
          ? `${connectedDevice?.name || 'デバイス'} 接続中` 
          : 'デバイス未接続'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader 
        title="グラフ" 
        showMenu={false}
        showBack={true}
        showNotification={false}
      />
      
      <View style={styles.pageContainer}>
        {/* ✅ 接続状態バッジ */}
        <View style={styles.badgeContainer}>
          <ConnectionStatusBadge />
        </View>

        {/* タブ切り替え */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'vitals' && styles.activeTabButton]}
            onPress={() => setActiveTab('vitals')}
          >
            <Text style={[styles.tabText, activeTab === 'vitals' && styles.activeTabText]}>
              心拍・体温
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'sleep' && styles.activeTabButton]}
            onPress={() => setActiveTab('sleep')}
          >
            <Text style={[styles.tabText, activeTab === 'sleep' && styles.activeTabText]}>
              睡眠時間
            </Text>
          </TouchableOpacity>
        </View>

        {/* コンテンツ */}
        <View style={styles.contentContainer}>
          {activeTab === 'vitals' && <HeartRateScreen />}
          {activeTab === 'sleep' && <SleepChartScreen />}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FEF1E7',
  },
  pageContainer: {
    flex: 1,
    paddingHorizontal: 15,
    paddingTop: 10,
    backgroundColor: '#FEF1E7',
  },
  // ✅ バッジコンテナ
  badgeContainer: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  // ✅ シンプルな接続状態バッジ
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  connectionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 20,
    padding: 3,
    alignSelf: 'center',
    maxWidth: 400,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeTabButton: {
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  tabText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#4A90E2',
    fontWeight: 'bold',
  },
  contentContainer: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 400,
  }
});
