// app/(app)/debug-log.tsx

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import type { LogEntry } from '../../context/BLEContext';
import { useBLE } from '../../context/BLEContext';

export default function DebugLogScreen() {
  const router = useRouter();
  const { debugLogs, clearLogs, isConnected, connectionStatus } = useBLE();
  const scrollViewRef = useRef<ScrollView>(null);

  // 新しいログが追加されたら自動スクロール
  useEffect(() => {
    if (scrollViewRef.current && debugLogs && debugLogs.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [debugLogs]);

  const getLogColor = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      case 'warning': return '#FF9800';
      default: return '#2196F3';
    }
  };

  const getLogIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const handleClearLogs = () => {
    clearLogs();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* カスタムヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>デバッグログ</Text>
        <View style={styles.headerRight} />
      </View>

      {/* 接続状態バー */}
      <View style={styles.statusBar}>
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusDot, 
            { backgroundColor: isConnected ? '#4CAF50' : '#F44336' }
          ]} />
          <Text style={styles.statusText}>{connectionStatus}</Text>
        </View>
        <Text style={styles.logCount}>ログ数: {debugLogs?.length || 0}</Text>
      </View>

      {/* ログ表示エリア */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.logContainer}
        contentContainerStyle={styles.logContent}
      >
        {!debugLogs || debugLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#666" />
            <Text style={styles.emptyText}>ログがありません</Text>
            <Text style={styles.emptySubText}>
              BLE接続やデータ受信が始まると{'\n'}ここにログが表示されます
            </Text>
          </View>
        ) : (
          debugLogs.map((log, index) => (
            <View key={index} style={[
              styles.logEntry,
              { borderLeftColor: getLogColor(log.type) }
            ]}>
              <View style={styles.logHeader}>
                <Text style={styles.logTimestamp}>{log.timestamp}</Text>
                <View style={[
                  styles.logTypeBadge,
                  { backgroundColor: getLogColor(log.type) + '20' }
                ]}>
                  <Text style={[
                    styles.logTypeText,
                    { color: getLogColor(log.type) }
                  ]}>
                    {log.type}
                  </Text>
                </View>
              </View>
              <View style={styles.logMessageContainer}>
                <Text style={styles.logIcon}>
                  {getLogIcon(log.type)}
                </Text>
                <Text style={[
                  styles.logMessage,
                  { color: getLogColor(log.type) }
                ]}>
                  {log.message}
                </Text>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* フッターボタン */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[
            styles.clearButton,
            (!debugLogs || debugLogs.length === 0) && styles.disabledButton
          ]} 
          onPress={handleClearLogs}
          disabled={!debugLogs || debugLogs.length === 0}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.buttonText}>ログをクリア</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.scrollButton}
          onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          <Ionicons name="arrow-down" size={18} color="#fff" />
          <Text style={styles.buttonText}>最下部へ</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    color: '#ccc',
    fontSize: 14,
  },
  logCount: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  logContent: {
    padding: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubText: {
    color: '#555',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  logEntry: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#444',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logTimestamp: {
    color: '#888',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  logTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logTypeText: {
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  logMessageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  logIcon: {
    fontSize: 16,
    marginRight: 8,
    marginTop: 1,
  },
  logMessage: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    gap: 12,
  },
  clearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#666',
    opacity: 0.5,
  },
  scrollButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4a90e2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
});