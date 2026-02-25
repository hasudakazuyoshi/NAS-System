// app/(app)/settings/user-info.tsx

import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// ✅ BLEContextを使用
import { useBLE } from '../../context/BLEContext';

// @ts-ignore
import { getUserInfo, updateUserInfo } from '../../api/apiService';

const INITIAL_DEVICE = { id: '', name: '未選択' };
type DeviceItem = { id: string; name: string };

interface ScannedDevice {
  id: string;
  name: string | null;
}

export default function UserInfoScreen() {
  const router = useRouter();
  
  // ✅ BLEContextを使用
  const {
    isConnected,
    connectedDevice,
    connectionStatus,
    startScan: bleStartScan,
    stopScan: bleStopScan,
    connect: bleConnect,
  } = useBLE();

  // --- 状態管理 ---
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [wearable, setWearable] = useState(INITIAL_DEVICE.id);
  
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('未設定');
  const [gender, setGender] = useState('未設定');

  const [initialData, setInitialData] = useState({ 
    height: '', weight: '', wearable: INITIAL_DEVICE.id 
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [devices, setDevices] = useState<DeviceItem[]>([INITIAL_DEVICE]);

  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [showDeviceModal, setShowDeviceModal] = useState(false);

  const [bleDebugInfo, setBleDebugInfo] = useState<string>('');

  // 1. 初期データ取得
  useEffect(() => {
    const fetchUserInfo = async () => {
      setIsLoading(true);
      try {
        const data = await getUserInfo();
        const h = data.height ? String(data.height) : '';
        const w = data.weight ? String(data.weight) : '';
        const devId = data.wearable || INITIAL_DEVICE.id;
        const devName = data.wearable_name || '登録済みデバイス';

        setHeight(h);
        setWeight(w);
        setWearable(devId);
        setEmail(data.email || '未設定');
        setDateOfBirth(data.birthdate || data.date_of_birth || '未設定');
        setGender(getGenderDisplay(data.gender || ''));

        if (devId && devId !== '') {
          setDevices([INITIAL_DEVICE, { id: devId, name: devName }]);
        }
        setInitialData({ height: h, weight: w, wearable: devId });
      } catch (error) {
        Alert.alert('エラー', 'データの取得に失敗しました');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserInfo();
  }, []);

  // ✅ 接続されたデバイスをリストに追加
  useEffect(() => {
    if (isConnected && connectedDevice) {
      const deviceId = connectedDevice.id;
      const deviceName = connectedDevice.name || '接続済みデバイス';
      
      const newDevice = {
        id: deviceId,
        name: deviceName
      };
      
      setDevices(prev => {
        if (!prev.find(d => d.id === newDevice.id)) {
          return [...prev, newDevice];
        }
        return prev;
      });
      
      setWearable(deviceId);
    }
  }, [isConnected, connectedDevice]);

  const getGenderDisplay = (val: string): string => {
    if (!val) return '未設定';
    const lower = val.toLowerCase();
    if (['male', 'm', '男性'].includes(lower)) return '男性';
    if (['female', 'f', '女性'].includes(lower)) return '女性';
    return val;
  };

  const hasChanges = 
    height !== initialData.height || 
    weight !== initialData.weight || 
    wearable !== initialData.wearable;

  // ✅ デバイススキャン開始（BLEContextを使用）
  const startScan = async () => {
    try {
      setScannedDevices([]);
      setShowDeviceModal(true);
      setIsScanning(true);

      await bleStartScan(
        (device) => {
          if (device && device.name) {
            setScannedDevices((prev) => {
              if (!prev.find((d) => d.id === device.id)) {
                return [...prev, { id: device.id, name: device.name }];
              }
              return prev;
            });
          }
        },
        (error) => {
          setIsScanning(false);
          Alert.alert('エラー', 'デバイスのスキャンに失敗しました');
        }
      );

      setTimeout(() => {
        stopScan();
      }, 15000);

    } catch (error) {
      setIsScanning(false);
      Alert.alert('エラー', 'Bluetoothスキャンを開始できませんでした');
    }
  };

  // ✅ スキャン停止
  const stopScan = () => {
    bleStopScan();
    setIsScanning(false);
  };

  // ✅ デバイス選択と接続（BLEContextを使用）
  const handleSelectDevice = async (device: ScannedDevice) => {
    stopScan();
    setShowDeviceModal(false);

    let log = '';

    try {
      log += `🔵 接続開始: ${device.name} (${device.id})\n`;
      setBleDebugInfo(log);

      // ✅ BLEContextのconnectを使用（自動的にSensorDataManagerに送信される）
       await bleConnect(device.id , true);

      log += `✅ 接続成功\n`;
      log += `✅ サービス探索完了\n`;
      log += `🚀 データ受信開始（自動的にDBに保存されます）\n`;
      setBleDebugInfo(log);
      
      // 接続後のデバイス情報を取得
      if (connectedDevice) {
        const services = await connectedDevice.services();
        log += `📋 サービス数: ${services.length}\n\n`;
        
        for (const service of services) {
          log += `サービスUUID:\n${service.uuid}\n`;
          const chars = await service.characteristics();
          for (const char of chars) {
            log += `  キャラクタ:\n  ${char.uuid}\n`;
            const props = [];
            if (char.isReadable) props.push('Read');
            if (char.isWritableWithResponse) props.push('Write');
            if (char.isNotifiable) props.push('Notify');
            log += `  ${props.join(', ')}\n\n`;
          }
        }
      }
      
      log += `⏰ 時刻同期完了\n`;
      log += `✅ 接続完了\n`;
      setBleDebugInfo(log);

      const newDevice = {
        id: device.id,
        name: device.name || '接続済みデバイス'
      };
      
      setDevices(prev => {
        if (!prev.find(d => d.id === newDevice.id)) {
          return [...prev, newDevice];
        }
        return prev;
      });
      
      setWearable(device.id);

      Alert.alert(
        '接続成功',
        `${device.name || 'デバイス'} に接続しました\nデータ受信を開始し、自動的にDBに保存されます`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      log += `❌ エラー: ${error}\n`;
      setBleDebugInfo(log);
      Alert.alert(
        '接続エラー',
        `デバイスへの接続に失敗しました\n\n${error}`
      );
    }
  };

  // 5. 情報保存
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateUserInfo({
        height: height ? parseFloat(height) : null,
        weight: weight ? parseFloat(weight) : null,
        wearable: wearable || null
      });
      Alert.alert("✅ 保存完了", "情報を更新しました");
      setInitialData({ height, weight, wearable });
    } catch (error) {
      Alert.alert("保存エラー", "情報の保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.pageContainer}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← 戻る</Text>
          </TouchableOpacity>
          <Text style={styles.title}>利用者情報</Text>
        </View>

        {/* ✅ BLE接続デバッグ情報 */}
        {bleDebugInfo && (
          <View style={styles.debugContainer}>
            <TouchableOpacity 
              style={styles.debugHeader}
              onPress={() => setBleDebugInfo('')}
            >
              <Text style={styles.debugTitle}>📱 BLE接続情報 (タップでクリア)</Text>
            </TouchableOpacity>
            <ScrollView style={styles.debugScroll}>
              <Text style={styles.debugText}>{bleDebugInfo}</Text>
            </ScrollView>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator size="large" color="#4a90e2" style={{ marginTop: 50 }} />
        ) : (
          <>
            {/* ✅ アカウント情報セクション */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📧 アカウント情報</Text>
              <View style={styles.card}>
                {/* メールアドレス */}
                <View style={styles.accountInfoRow}>
                  <View style={styles.accountInfoContent}>
                    <Text style={styles.infoLabel}>メールアドレス</Text>
                    <Text style={styles.infoValue}>{email}</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.changeButton}
                    onPress={() => router.push('/(app)/email-change')}
                  >
                    <Text style={styles.changeButtonText}>変更</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.accountDivider} />

                {/* パスワード */}
                <View style={styles.accountInfoRow}>
                  <View style={styles.accountInfoContent}>
                    <Text style={styles.infoLabel}>パスワード</Text>
                    <Text style={styles.infoValue}>••••••••</Text>
                  </View>
                  <TouchableOpacity 
                    style={styles.changeButton}
                    onPress={() => router.push('/(app)/password-change')}
                  >
                    <Text style={styles.changeButtonText}>変更</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 基本情報セクション */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>👤 基本情報</Text>
              <View style={styles.card}>
                <View style={styles.staticRow}>
                  <View style={styles.staticItem}>
                    <Text style={styles.infoLabel}>生年月日</Text>
                    <Text style={styles.staticValue}>{dateOfBirth}</Text>
                  </View>
                  <View style={styles.staticDivider} />
                  <View style={styles.staticItem}>
                    <Text style={styles.infoLabel}>性別</Text>
                    <Text style={styles.staticValue}>{gender}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 体格情報セクション */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📏 体格情報</Text>
              <View style={styles.card}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>身長</Text>
                  <TextInput 
                    style={styles.textInput} 
                    value={height} 
                    onChangeText={setHeight} 
                    keyboardType="decimal-pad" 
                    placeholder="0.0" 
                  />
                  <Text style={styles.unitText}>cm</Text>
                </View>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>体重</Text>
                  <TextInput 
                    style={styles.textInput} 
                    value={weight} 
                    onChangeText={setWeight} 
                    keyboardType="decimal-pad" 
                    placeholder="0.0" 
                  />
                  <Text style={styles.unitText}>kg</Text>
                </View>
              </View>
            </View>

            {/* ✅ ウェアラブル機器セクション */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⌚ ウェアラブル機器</Text>
              <View style={styles.card}>
                {/* BLE接続状態 */}
                <View style={styles.bleStatusContainer}>
                  <View style={styles.bleStatusHeader}>
                    <Text style={styles.bleStatusLabel}>接続状態</Text>
                    <View style={styles.bleStatusIndicator}>
                      <View style={[
                        styles.statusDot,
                        { backgroundColor: isConnected ? '#28a745' : '#dc3545' }
                      ]} />
                      <Text style={styles.bleStatusText}>{connectionStatus}</Text>
                    </View>
                  </View>
                  
                  {isConnected && connectedDevice?.name && (
                    <Text style={styles.connectedDeviceText}>
                      ✅ {connectedDevice.name}
                    </Text>
                  )}
                  
                  {!isConnected && (
                    <View style={styles.bleWarning}>
                      <Text style={styles.bleWarningIcon}>⚠️</Text>
                      <Text style={styles.bleWarningText}>
                        デバイスが接続されていません
                      </Text>
                    </View>
                  )}
                </View>

                {/* デバイス選択 */}
                <View style={styles.deviceRow}>
                  <View style={styles.pickerContainer}>
                    <Picker 
                      selectedValue={wearable} 
                      onValueChange={(val) => setWearable(val)}
                      enabled={devices.length > 1}
                    >
                      {devices.map((d, i) => (
                        <Picker.Item key={i} label={d.name} value={d.id} />
                      ))}
                    </Picker>
                  </View>
                  
                  <TouchableOpacity 
                    style={[styles.searchButton, isScanning && styles.disabledButton]} 
                    onPress={startScan}
                    disabled={isScanning}
                  >
                    <Text style={styles.searchButtonText}>
                      {isScanning ? '検索中...' : '🔍 検索'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.saveButton, (!hasChanges || isSaving) && styles.disabledButton]} 
              onPress={handleSave} 
              disabled={!hasChanges || isSaving}
            >
              <Text style={styles.saveButtonText}>
                {isSaving ? '保存中...' : '💾 変更を保存'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* ✅ デバイス選択モーダル */}
      <Modal
        visible={showDeviceModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowDeviceModal(false);
          stopScan();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>機器を選択</Text>
              {isScanning && <ActivityIndicator size="small" color="#4a90e2" />}
            </View>
            <Text style={styles.modalSubtitle}>近くにあるデバイスを表示しています...</Text>

            {scannedDevices.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>デバイスを探しています...</Text>
              </View>
            ) : (
              <FlatList
                data={scannedDevices}
                keyExtractor={(item) => item.id}
                style={styles.deviceList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.deviceItem}
                    onPress={() => handleSelectDevice(item)}
                  >
                    <View>
                      <Text style={styles.deviceName}>{item.name || '名称不明'}</Text>
                      <Text style={styles.deviceId}>{item.id}</Text>
                    </View>
                    <Text style={styles.selectText}>選択</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowDeviceModal(false);
                stopScan();
              }}
            >
              <Text style={styles.closeButtonText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f7fa' },
  pageContainer: { padding: 16 },
  header: { marginBottom: 20 },
  backButton: { 
    alignSelf: 'flex-start', 
    padding: 8, 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    elevation: 2 
  },
  backButtonText: { color: '#333', fontWeight: 'bold' },
  title: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    marginTop: 10 
  },
  section: { marginBottom: 24 },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginBottom: 10, 
    color: '#555' 
  },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 16, 
    elevation: 2 
  },
  
  // ✅ アカウント情報用スタイル
  accountInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  accountInfoContent: {
    flex: 1,
  },
  accountDivider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 8,
  },
  changeButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginLeft: 12,
  },
  changeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  infoLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  infoValue: { fontSize: 16, fontWeight: '600' },
  staticRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center' 
  },
  staticItem: { flex: 1, alignItems: 'center' },
  staticDivider: { width: 1, height: 30, backgroundColor: '#eee' },
  staticValue: { fontSize: 18, fontWeight: 'bold', marginTop: 4 },
  inputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 15 
  },
  inputLabel: { width: 60, fontWeight: 'bold', color: '#333' },
  textInput: { 
    flex: 1, 
    backgroundColor: '#f9f9f9', 
    padding: 10, 
    borderRadius: 8, 
    borderWidth: 1, 
    borderColor: '#eee', 
    fontSize: 16 
  },
  unitText: { marginLeft: 10, color: '#666', width: 30 },
  
  bleStatusContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  bleStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bleStatusLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#333',
  },
  bleStatusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  bleStatusText: {
    fontSize: 12,
    color: '#666',
  },
  connectedDeviceText: {
    fontSize: 13,
    color: '#28a745',
    fontWeight: '500',
  },
  bleWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 8,
    borderRadius: 6,
  },
  bleWarningIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  bleWarningText: {
    fontSize: 12,
    color: '#856404',
    flex: 1,
  },
  
  deviceRow: { 
    flexDirection: 'row', 
    gap: 10 
  },
  pickerContainer: { 
    flex: 1,
    borderWidth: 1, 
    borderColor: '#eee', 
    borderRadius: 8, 
    backgroundColor: '#f9f9f9', 
    overflow: 'hidden' 
  },
  searchButton: { 
    backgroundColor: '#6c757d', 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    justifyContent: 'center' 
  },
  searchButtonText: { 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: 14,
  },
  
  saveButton: { 
    backgroundColor: '#4a90e2', 
    padding: 16, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 10 
  },
  disabledButton: { backgroundColor: '#ccc' },
  saveButtonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    padding: 20, 
    height: '60%' 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 5 
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: 'bold' 
  },
  modalSubtitle: { 
    fontSize: 12, 
    color: '#666', 
    marginBottom: 15 
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  emptyText: { 
    color: '#888' 
  },
  deviceList: { 
    flex: 1 
  },
  deviceItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee' 
  },
  deviceName: { 
    fontSize: 16, 
    fontWeight: 'bold' 
  },
  deviceId: { 
    fontSize: 12, 
    color: '#888', 
    marginTop: 2 
  },
  selectText: { 
    color: '#4a90e2', 
    fontWeight: 'bold' 
  },
  closeButton: { 
    marginTop: 15, 
    padding: 15, 
    alignItems: 'center', 
    backgroundColor: '#eee', 
    borderRadius: 10 
  },
  closeButtonText: { 
    fontWeight: 'bold', 
    color: '#666' 
  },
  
  debugContainer: {
    backgroundColor: '#1e1e1e',
    padding: 10,
    margin: 10,
    marginTop: 0,
    borderRadius: 8,
    maxHeight: 250,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  debugHeader: {
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    marginBottom: 8,
  },
  debugTitle: {
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: 14,
  },
  debugScroll: {
    maxHeight: 180,
  },
  debugText: {
    color: '#00ff00',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 16,
  },
});
