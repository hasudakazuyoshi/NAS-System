// contexts/BLEContext.tsx (完全版 - 循環参照解消)

import { decode as atob, encode as btoa } from 'base-64';
import React, { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import SensorDataManager, { initializeSensorDataManagerLogger } from '../services/SensorDataManager';

const SERVICE_UUID = 'abcd1234-ef56-7890-abcd-1234567890ab';
const CHARACTERISTIC_UUID = '12345678-1234-1234-1234-1234567890ab';

export interface SensorData {
  datetime: string;
  heartRate: number;
  temperature: number;
  movement: number;
  timestamp: Date;
}

export interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface BLEContextType {
  isConnected: boolean;
  connectedDevice: Device | null;
  connectionStatus: string;
  isMonitoring: boolean;
  lastReceivedData: SensorData | null;
  debugLogs: LogEntry[];
  clearLogs: () => void;
  addLog: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  
  startScan: (
    onDeviceFound: (device: Device) => void,
    onError: (error: any) => void
  ) => Promise<void>;
  stopScan: () => void;
  connect: (deviceId: string, withTimeSync?: boolean) => Promise<Device>;
  disconnect: () => Promise<void>;
  syncTime: () => Promise<boolean>;
}

const BLEContext = createContext<BLEContextType | undefined>(undefined);

export const BLEProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [bleManager] = useState(() => new BleManager());
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('未接続');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [lastReceivedData, setLastReceivedData] = useState<SensorData | null>(null);
  const [debugLogs, setDebugLogs] = useState<LogEntry[]>([]);

  const receivedChunksRef = useRef<{ [key: number]: string }>({});
  const expectedChunksRef = useRef<number>(0);

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString('ja-JP');
    const logEntry: LogEntry = { timestamp, message, type };
    console.log(`[${timestamp}] ${message}`);
    setDebugLogs(prev => [...prev.slice(-100), logEntry]);
  };

  const clearLogs = () => {
    setDebugLogs([]);
    addLog('ログをクリアしました', 'info');
  };

  // ✅ SensorDataManagerにログ関数を注入
  useEffect(() => {
    initializeSensorDataManagerLogger(addLog);
    addLog('🚀 BLEContext初期化', 'info');
    
    return () => {
      addLog('🔴 BLEContextクリーンアップ', 'info');
      if (subscription) {
        subscription.remove();
      }
      bleManager.destroy();
    };
  }, []);

  useEffect(() => {
    if (!connectedDevice || !isConnected) return;

    const interval = setInterval(async () => {
      try {
        const connected = await connectedDevice.isConnected();
        if (!connected) {
          addLog('⚠️ 接続が切れました', 'warning');
          handleDisconnect();
        }
      } catch (error) {
        // 無視
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [connectedDevice, isConnected]);

  const handleDisconnect = () => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
    }
    setIsConnected(false);
    setConnectionStatus('未接続');
    setConnectedDevice(null);
    setIsMonitoring(false);
    setLastReceivedData(null);
    receivedChunksRef.current = {};
    expectedChunksRef.current = 0;
    addLog('🔌 切断しました', 'info');
  };

  const parseData = (dataString: string): SensorData | null => {
    try {
      addLog(`🔍 パース開始: "${dataString}"`, 'info');
      
      const parts = dataString.split(',').map(p => p.trim());
      addLog(`📦 分割結果: [${parts.map(p => `"${p}"`).join(', ')}]`, 'info');
      addLog(`📦 パーツ数: ${parts.length}`, 'info');
      
      if (parts.length < 4) {
        addLog(`⚠️ パーツ数不足: ${parts.length} (必要: 4)`, 'warning');
        return null;
      }

      const datetimeStr = parts[0];
      let heartRate = parseFloat(parts[1]);
      let temperature = parseFloat(parts[2]);
      let movement = parseFloat(parts[3]);

      // ✅ 異常値の補正
      if (heartRate > 200 || heartRate < 30) {
        addLog(`⚠️ 異常な心拍数: ${heartRate} → 60に補正`, 'warning');
        heartRate = 60;
      }
      
      if (temperature > 45 || temperature < 30) {
        addLog(`⚠️ 異常な体温: ${temperature} → 36.5に補正`, 'warning');
        temperature = 36.5;
      }
      
      if (movement > 100 || movement < 0) {
        addLog(`⚠️ 異常な動き: ${movement} → 0に補正`, 'warning');
        movement = 0;
      }

      addLog(`  datetime="${datetimeStr}"`, 'info');
      addLog(`  heartRate=${heartRate}`, 'info');
      addLog(`  temperature=${temperature}`, 'info');
      addLog(`  movement=${movement}`, 'info');

      if (isNaN(heartRate) || isNaN(temperature) || isNaN(movement)) {
        addLog('⚠️ 数値変換失敗', 'warning');
        return null;
      }

      const datetimeISO = datetimeStr
        .replace(/\//g, '-')
        .replace(' ', 'T')
        + '.000Z';

      addLog(`  📅 変換後datetime: "${datetimeISO}"`, 'info');

      const result = {
        datetime: datetimeISO,
        heartRate,
        temperature,
        movement,
        timestamp: new Date(datetimeISO),
      };

      addLog('✅ パース成功!', 'success');
      return result;
      
    } catch (error) {
      addLog(`❌ パースエラー: ${error}`, 'error');
      return null;
    }
  };

  const hexToAscii = (hex: string): string => {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.substr(i, 2), 16);
      if (charCode > 0) str += String.fromCharCode(charCode);
    }
    return str;
  };

  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    if ((Platform.Version as number) >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return (
        result['android.permission.BLUETOOTH_CONNECT'] === 'granted' &&
        result['android.permission.BLUETOOTH_SCAN'] === 'granted'
      );
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === 'granted';
    }
  };

  const startScan = async (
    onDeviceFound: (device: Device) => void,
    onError: (error: any) => void
  ) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      addLog('❌ Bluetooth権限なし', 'error');
      onError(new Error('Bluetooth権限が許可されていません'));
      return;
    }

    addLog('🔍 スキャン開始', 'info');
    bleManager.startDeviceScan(null, null, (error, device) => {
      if (error) {
        addLog(`❌ スキャンエラー: ${error.message}`, 'error');
        onError(error);
        return;
      }
      if (device?.name) {
        onDeviceFound(device);
      }
    });
  };

  const stopScan = () => {
    bleManager.stopDeviceScan();
    addLog('⏹️ スキャン停止', 'info');
  };

  const syncTimeInternal = async (device: Device) => {
    const currentTime = Math.floor(Date.now() / 1000);
    const timeString = `T${currentTime}`;
    const timeData = btoa(timeString);

    addLog(`⏰ 時刻同期: ${timeString}`, 'info');

    await device.writeCharacteristicWithResponseForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      timeData
    );

    addLog('✅ 時刻同期送信完了', 'success');
  };

  const startMonitoring = (device: Device) => {
    addLog('👀 データ監視開始', 'info');
    setIsMonitoring(true);

    Alert.alert('✅ 監視開始', 'BLEデータ受信の準備ができました');

    let receiveCount = 0;

    const sub = device.monitorCharacteristicForService(
      SERVICE_UUID,
      CHARACTERISTIC_UUID,
      async (error, characteristic) => {
        receiveCount++;
        addLog(`📡 BLE受信 #${receiveCount}`, 'info');
        
        if (error) {
          addLog(`❌ 受信エラー: ${error.message}`, 'error');
          Alert.alert('❌ BLE受信エラー', error.message);
          return;
        }

        if (!characteristic?.value) {
          addLog('⚠️ characteristic.value が空', 'warning');
          return;
        }

        try {
          const decodedData = atob(characteristic.value);
          let textData = /^[0-9A-Fa-f]+$/.test(decodedData) 
            ? hexToAscii(decodedData) 
            : decodedData;

          addLog(`📥 受信: ${textData.substring(0, 30)}...`, 'info');

          if (textData.trim() === 'SYNC_OK') {
            addLog('✅ SYNC_OK受信', 'success');
            Alert.alert('✅ 時刻同期完了', 'ESP32との時刻同期が完了しました\n1分後にデータ送信が開始されます');
            receivedChunksRef.current = {};
            expectedChunksRef.current = 0;
            return;
          }

          if (textData.trim() === 'END') {
            addLog('🎯 ENDを検出', 'success');
            
            const currentExpectedChunks = expectedChunksRef.current;
            const currentReceivedChunks = { ...receivedChunksRef.current };
            
            addLog(`📊 expectedChunks: ${currentExpectedChunks}`, 'info');
            addLog(`📊 receivedChunks keys: ${Object.keys(currentReceivedChunks).join(', ')}`, 'info');
            
            receivedChunksRef.current = {};
            expectedChunksRef.current = 0;
            
            let fullData = '';
            for (let i = 1; i <= currentExpectedChunks; i++) {
              if (currentReceivedChunks[i]) {
                addLog(`  ✅ チャンク${i}: "${currentReceivedChunks[i]}"`, 'info');
                fullData += currentReceivedChunks[i];
              } else {
                addLog(`  ⚠️ チャンク${i}: 欠損`, 'warning');
              }
            }
            
            addLog(`📦 結合完了: "${fullData}"`, 'info');
            addLog(`📏 結合データ長: ${fullData.length}`, 'info');
            
            if (fullData.length > 0) {
              addLog('🔄 パース処理開始...', 'info');
              const sensorData = parseData(fullData);
              
              if (sensorData) {
                addLog(`✅ データ受信成功: HR=${sensorData.heartRate}, TEMP=${sensorData.temperature.toFixed(1)}, MOV=${sensorData.movement.toFixed(2)}`, 'success');
                setLastReceivedData(sensorData);
                
                Alert.alert(
                  '📥 データ受信成功', 
                  `時刻: ${sensorData.datetime}\n心拍: ${sensorData.heartRate} bpm\n体温: ${sensorData.temperature.toFixed(1)}°C\n動き: ${sensorData.movement.toFixed(2)}`,
                  [{ text: 'OK' }]
                );
                
                try {
                  const unsentCount = await SensorDataManager.onDataReceived(sensorData, fullData);
                  addLog('✅ AsyncStorage保存成功', 'success');
                  addLog(`📊 保存後の未送信件数: ${unsentCount}件`, 'info');
                } catch (err) {
                  addLog(`❌ AsyncStorage保存エラー: ${err}`, 'error');
                  Alert.alert('保存エラー', `データの保存に失敗しました:\n${err}`);
                }
                
              } else {
                addLog('⚠️ パース失敗 - データ形式が不正', 'warning');
                addLog(`   失敗データ: "${fullData}"`, 'warning');
              }
            } else {
              addLog('⚠️ 結合データが空です', 'warning');
            }
            
            return;
          }

          const match = textData.match(/^(\d+)\/(\d+):(.*)$/);
          if (match) {
            const currentChunk = parseInt(match[1]);
            const totalChunks = parseInt(match[2]);
            const chunkData = match[3];
            
            addLog(`📦 チャンク ${currentChunk}/${totalChunks}: "${chunkData}"`, 'info');
            
            if (currentChunk === 1) {
              expectedChunksRef.current = totalChunks;
              addLog(`📊 総チャンク数設定: ${totalChunks}`, 'info');
            }
            
            receivedChunksRef.current = {
              ...receivedChunksRef.current,
              [currentChunk]: chunkData
            };
            
            addLog(`📝 保存済みチャンク: ${Object.keys(receivedChunksRef.current).length}/${totalChunks}`, 'info');
          } else {
            addLog(`⚠️ 不明なデータ: ${textData}`, 'warning');
          }
          
        } catch (error) {
          addLog(`❌ データ処理エラー: ${error}`, 'error');
          receivedChunksRef.current = {};
          expectedChunksRef.current = 0;
        }
      }
    );

    setSubscription(sub);
    addLog('✅ サブスクリプション設定完了', 'success');
  };

  const connect = async (deviceId: string, withTimeSync: boolean = true): Promise<Device> => {
    try {
      addLog(`🔵 接続開始: ${deviceId}`, 'info');
      setConnectionStatus('接続中...');

      const device = await bleManager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();

      startMonitoring(device);

      if (withTimeSync) {
        await new Promise(resolve => setTimeout(resolve, 500));
        try {
          await syncTimeInternal(device);
        } catch (error) {
          addLog('⚠️ 時刻同期失敗（接続は継続）', 'warning');
          Alert.alert('⚠️ 警告', '時刻同期に失敗しましたが接続は継続します');
        }
      }

      setConnectedDevice(device);
      setIsConnected(true);
      setConnectionStatus('接続完了');
      addLog('✅ 接続完了', 'success');

      return device;
    } catch (error) {
      addLog(`❌ 接続エラー: ${error}`, 'error');
      setConnectionStatus('接続失敗');
      Alert.alert('❌ 接続エラー', String(error));
      throw error;
    }
  };

  const disconnect = async () => {
    if (subscription) {
      subscription.remove();
      setSubscription(null);
    }
    
    if (connectedDevice) {
      try {
        await connectedDevice.cancelConnection();
        addLog('🔌 切断完了', 'info');
      } catch (error) {
        addLog(`❌ 切断エラー: ${error}`, 'error');
      }
    }
    
    setConnectedDevice(null);
    setIsConnected(false);
    setConnectionStatus('未接続');
    setIsMonitoring(false);
    setLastReceivedData(null);
    receivedChunksRef.current = {};
    expectedChunksRef.current = 0;
  };

  const syncTime = async (): Promise<boolean> => {
    if (!connectedDevice) {
      throw new Error('デバイスが接続されていません');
    }
    await syncTimeInternal(connectedDevice);
    return true;
  };

  const value: BLEContextType = {
    isConnected,
    connectedDevice,
    connectionStatus,
    isMonitoring,
    lastReceivedData,
    debugLogs,
    clearLogs,
    addLog,
    startScan,
    stopScan,
    connect,
    disconnect,
    syncTime,
  };

  return <BLEContext.Provider value={value}>{children}</BLEContext.Provider>;
};

export const useBLE = () => {
  const context = useContext(BLEContext);
  if (!context) {
    throw new Error('useBLE must be used within BLEProvider');
  }
  return context;
};