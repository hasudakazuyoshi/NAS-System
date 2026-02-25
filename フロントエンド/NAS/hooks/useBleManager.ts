// // hooks/useBleManager.ts

// import { decode as atob, encode as btoa } from 'base-64';
// import { useEffect, useState } from 'react';
// import { PermissionsAndroid, Platform } from 'react-native';
// import { BleManager, Device, Subscription } from 'react-native-ble-plx';

// // ✅ マイコンのUUID設定
// const SERVICE_UUID = 'abcd1234-ef56-7890-abcd-1234567890ab';
// const CHARACTERISTIC_UUID = '12345678-1234-1234-1234-1234567890ab';

// // ✅ センサーデータの型定義(修正版)
// export interface SensorData {
//   datetime: string;      // 2026/01/21 10:46:23
//   heartRate: number;     // BPM
//   temperature: number;   // Temp
//   movement: number;      // Mov
//   timestamp: Date;       // JSのDateオブジェクト
// }

// const useBleManager = () => {
//   const [bleManager] = useState(() => new BleManager());
//   const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
//   const [isConnected, setIsConnected] = useState(false);
//   const [connectionStatus, setConnectionStatus] = useState('未接続');
  
//   // ✅ データ受信関連
//   const [dataBuffer, setDataBuffer] = useState<string>('');
//   const [subscription, setSubscription] = useState<Subscription | null>(null);
//   const [isMonitoring, setIsMonitoring] = useState(false);

//   // クリーンアップ
//   useEffect(() => {
//     return () => {
//       if (subscription) {
//         subscription.remove();
//       }
//       bleManager.destroy();
//     };
//   }, [bleManager, subscription]);

//   // ✅ 定期的な接続状態チェック
//   useEffect(() => {
//     const interval = setInterval(async () => {
//       if (connectedDevice) {
//         try {
//           const connected = await connectedDevice.isConnected();
//           if (!connected && isConnected) {
//             console.log('⚠️ 接続が切れました');
//             setIsConnected(false);
//             setConnectionStatus('未接続');
//             setConnectedDevice(null);
            
//             if (subscription) {
//               subscription.remove();
//               setSubscription(null);
//               setIsMonitoring(false);
//             }
//           }
//         } catch (error) {
//           console.error('接続状態確認エラー:', error);
//         }
//       }
//     }, 5000);

//     return () => clearInterval(interval);
//   }, [connectedDevice, isConnected, subscription]);

//   // 権限リクエスト
//   const requestPermissions = async (): Promise<boolean> => {
//     if (Platform.OS === 'android') {
//       if ((Platform.Version as number) >= 31) {
//         const result = await PermissionsAndroid.requestMultiple([
//           PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
//           PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
//           PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
//         ]);
//         return (
//           result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
//           result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED
//         );
//       } else {
//         const granted = await PermissionsAndroid.request(
//           PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
//         );
//         return granted === PermissionsAndroid.RESULTS.GRANTED;
//       }
//     }
//     return true;
//   };

//   // スキャン開始
//   const startScan = async (
//     onDeviceFound: (device: Device) => void,
//     onError: (error: any) => void
//   ) => {
//     const hasPermission = await requestPermissions();
//     if (!hasPermission) {
//       onError(new Error('Bluetooth権限が許可されていません'));
//       return;
//     }

//     bleManager.startDeviceScan(null, null, (error, device) => {
//       if (error) {
//         console.error('スキャンエラー:', error);
//         onError(error);
//         return;
//       }

//       if (device && device.name) {
//         onDeviceFound(device);
//       }
//     });
//   };

//   // スキャン停止
//   const stopScan = () => {
//     bleManager.stopDeviceScan();
//   };

//   // ✅ 時刻同期
//   const syncTime = async (device: Device) => {
//     try {
//       console.log('⏰ 時刻同期開始');
      
//       const currentTime = Math.floor(Date.now() / 1000).toString();
//       console.log('送信する時刻:', currentTime);
      
//       const timeData = btoa(currentTime);
      
//       await device.writeCharacteristicWithResponseForService(
//         SERVICE_UUID,
//         CHARACTERISTIC_UUID,
//         timeData
//       );
      
//       console.log('✅ 時刻同期完了:', currentTime);
//       return true;
//     } catch (error) {
//       console.error('❌ 時刻同期エラー:', error);
//       throw new Error('時刻同期に失敗しました');
//     }
//   };

//   // ✅ 16進数文字列をASCII文字列に変換
//   const hexToAscii = (hex: string): string => {
//     let str = '';
//     for (let i = 0; i < hex.length; i += 2) {
//       const hexByte = hex.substr(i, 2);
//       const charCode = parseInt(hexByte, 16);
//       if (charCode > 0) {
//         str += String.fromCharCode(charCode);
//       }
//     }
//     return str;
//   };

//   // ✅ データをパース
//   // フォーマット: 2026/01/21 10:46:23,BPM:58,Temp:37.7,Mov:1.57
//   const parseData = (dataString: string): SensorData | null => {
//     try {
//       console.log('🔍 パース対象:', dataString);

//       // カンマで分割
//       const parts = dataString.split(',');
//       if (parts.length < 4) {
//         console.error('❌ データ形式が不正:', parts);
//         return null;
//       }

//       // 日時を取得
//       const datetime = parts[0].trim();

//       // BPM, Temp, Movを抽出
//       const bpmMatch = parts[1].match(/BPM:(\d+\.?\d*)/);
//       const tempMatch = parts[2].match(/Temp:(\d+\.?\d*)/);
//       const movMatch = parts[3].match(/Mov:(\d+\.?\d*)/);

//       if (!bpmMatch || !tempMatch || !movMatch) {
//         console.error('❌ パース失敗:', { bpmMatch, tempMatch, movMatch });
//         return null;
//       }

//       const heartRate = parseFloat(bpmMatch[1]);
//       const temperature = parseFloat(tempMatch[1]);
//       const movement = parseFloat(movMatch[1]);

//       return {
//         datetime,
//         heartRate,
//         temperature,
//         movement,
//         timestamp: new Date(),
//       };
//     } catch (error) {
//       console.error('❌ パースエラー:', error);
//       return null;
//     }
//   };

//   // ✅ データ監視開始
//   const startMonitoring = (
//     onDataReceived: (data: SensorData, rawData: string) => void,
//     onError?: (error: any) => void
//   ) => {
//     if (!connectedDevice) {
//       console.error('❌ デバイスが接続されていません');
//       if (onError) onError(new Error('デバイスが接続されていません'));
//       return;
//     }

//     if (isMonitoring) {
//       console.warn('⚠️ 既に監視中です');
//       return;
//     }

//     console.log('👀 データ監視開始');
//     setIsMonitoring(true);

//     let buffer = '';

//     const sub = connectedDevice.monitorCharacteristicForService(
//       SERVICE_UUID,
//       CHARACTERISTIC_UUID,
//       (error, characteristic) => {
//         if (error) {
//           console.error('❌ 受信エラー:', error);
//           if (onError) onError(error);
//           return;
//         }

//         if (!characteristic?.value) {
//           return;
//         }

//         try {
//           // Base64デコード
//           const base64Data = characteristic.value;
//           const decodedData = atob(base64Data);
          
//           console.log('📥 受信データ(Raw):', decodedData);

//           // 16進数の場合は変換、そうでなければそのまま
//           let textData = decodedData;
          
//           // 16進数かどうかをチェック(全て16進数文字なら変換)
//           if (/^[0-9A-Fa-f]+$/.test(decodedData)) {
//             textData = hexToAscii(decodedData);
//             console.log('🔄 16進数→ASCII:', textData);
//           }

//           // バッファに追加
//           buffer += textData;
          
//           // ENDマーカーを探す
//           if (buffer.includes('END')) {
//             const endIndex = buffer.indexOf('END');
//             const completeData = buffer.substring(0, endIndex);
            
//             console.log('📦 完全データ:', completeData);
            
//             // パース
//             const sensorData = parseData(completeData);
//             if (sensorData) {
//               console.log('✅ センサーデータ:', sensorData);
//               onDataReceived(sensorData, completeData);
//             }
            
//             // バッファクリア
//             buffer = buffer.substring(endIndex + 3); // "END"の後をクリア
//           }
//         } catch (error) {
//           console.error('❌ データ処理エラー:', error);
//           if (onError) onError(error);
//         }
//       }
//     );

//     setSubscription(sub);
//   };

//   // ✅ データ監視停止
//   const stopMonitoring = () => {
//     if (subscription) {
//       subscription.remove();
//       setSubscription(null);
//       setIsMonitoring(false);
//       setDataBuffer('');
//       console.log('⏹️ データ監視停止');
//     }
//   };

//   // ✅ デバイスに接続(時刻同期 + 自動監視開始)
// const connect = async (
//   deviceId: string, 
//   withTimeSync: boolean = true,
//   onDataReceived?: (data: SensorData, rawData: string) => void,
//   onError?: (error: any) => void
// ) => {
//   try {
//     console.log('🔵 接続開始:', deviceId);
//     setConnectionStatus('接続中...');

//     const device = await bleManager.connectToDevice(deviceId);
//     console.log('✅ 接続成功');

//     await device.discoverAllServicesAndCharacteristics();
//     console.log('✅ サービス探索完了');

//     const services = await device.services();
//     console.log('📋 利用可能なサービス:');
//     for (const service of services) {
//       console.log(`  サービスUUID: ${service.uuid}`);
//       const chars = await service.characteristics();
//       for (const char of chars) {
//         console.log(`    - キャラクタリスティック: ${char.uuid}`);
//         const props = [];
//         if (char.isReadable) props.push('Read');
//         if (char.isWritableWithResponse) props.push('Write');
//         if (char.isNotifiable) props.push('Notify');
//         console.log(`      プロパティ: ${props.join(', ')}`);
//       }
//     }

//     if (withTimeSync) {
//       try {
//         await syncTime(device);
//       } catch (syncError) {
//         console.warn('⚠️ 時刻同期に失敗しましたが、接続は継続します:', syncError);
//       }
//     }

//     setConnectedDevice(device);
//     setIsConnected(true);
//     setConnectionStatus('接続完了');

//     // ✅ 接続成功後、自動的にデータ監視を開始
//     if (onDataReceived) {
//       console.log('🚀 自動データ監視開始');
      
//       let buffer = '';
      
//       const sub = device.monitorCharacteristicForService(
//         SERVICE_UUID,
//         CHARACTERISTIC_UUID,
//         (error, characteristic) => {
//           if (error) {
//             console.error('❌ 受信エラー:', error);
//             if (onError) onError(error);
//             return;
//           }

//           if (!characteristic?.value) {
//             return;
//           }

//           try {
//             const base64Data = characteristic.value;
//             const decodedData = atob(base64Data);
            
//             console.log('📥 受信データ(Raw):', decodedData);

//             let textData = decodedData;
            
//             if (/^[0-9A-Fa-f]+$/.test(decodedData)) {
//               textData = hexToAscii(decodedData);
//               console.log('🔄 16進数→ASCII:', textData);
//             }

//             buffer += textData;
            
//             if (buffer.includes('END')) {
//               const endIndex = buffer.indexOf('END');
//               const completeData = buffer.substring(0, endIndex);
              
//               console.log('📦 完全データ:', completeData);
              
//               const sensorData = parseData(completeData);
//               if (sensorData) {
//                 console.log('✅ センサーデータ:', sensorData);
//                 onDataReceived(sensorData, completeData);
//               }
              
//               buffer = buffer.substring(endIndex + 3);
//             }
//           } catch (error) {
//             console.error('❌ データ処理エラー:', error);
//             if (onError) onError(error);
//           }
//         }
//       );

//       setSubscription(sub);
//       setIsMonitoring(true);
//     }

//     return device;
//   } catch (error) {
//     console.error('❌ 接続エラー:', error);
//     setConnectionStatus('接続失敗');
//     setIsConnected(false);
//     throw error;
//   }
// };

//   // ✅ 接続済みデバイスに時刻を再同期
//   const resyncTime = async () => {
//     if (!connectedDevice) {
//       throw new Error('デバイスが接続されていません');
//     }
    
//     try {
//       await syncTime(connectedDevice);
//       return true;
//     } catch (error) {
//       console.error('❌ 時刻再同期エラー:', error);
//       throw error;
//     }
//   };

//   // 切断
//   const disconnect = async () => {
//     stopMonitoring();
    
//     if (connectedDevice) {
//       try {
//         await connectedDevice.cancelConnection();
//         console.log('🔌 切断完了');
//         setConnectedDevice(null);
//         setIsConnected(false);
//         setConnectionStatus('未接続');
//       } catch (error) {
//         console.error('切断エラー:', error);
//       }
//     }
//   };

//   // 接続状態確認
//   const checkIsConnected = async (): Promise<boolean> => {
//     return isConnected;
//   };

//   // 接続中のデバイスID取得
//   const getConnectedDeviceId = async (): Promise<string | null> => {
//     if (!connectedDevice) return null;
//     return connectedDevice.id;
//   };

//   // 接続中のデバイス名取得
//   const getConnectedDeviceName = async (): Promise<string | null> => {
//     if (!connectedDevice) return null;
//     return connectedDevice.name;
//   };

//   // UUID取得
//   const getServiceUUID = () => SERVICE_UUID;
//   const getCharacteristicUUID = () => CHARACTERISTIC_UUID;

//   return {
//     // 状態
//     isConnected,
//     connectedDevice,
//     connectionStatus,
//     isMonitoring,
    
//     // メソッド
//     startScan,
//     stopScan,
//     connect,
//     disconnect,
//     checkIsConnected,
//     getConnectedDeviceId,
//     getConnectedDeviceName,
    
//     // 時刻同期関連
//     syncTime: resyncTime,
    
//     // ✅ データ受信関連
//     startMonitoring,
//     stopMonitoring,
    
//     // UUID取得
//     getServiceUUID,
//     getCharacteristicUUID,
//   };
// };

// export default useBleManager;
