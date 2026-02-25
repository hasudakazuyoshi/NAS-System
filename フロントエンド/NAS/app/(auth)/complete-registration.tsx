// app/(auth)/complete-registration.tsx

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// ✅ BLEContextを使用
import { useBLE } from '../../context/BLEContext';

const API_BASE_URL = 'https://lacrimal-valleylike-lilyana.ngrok-free.dev/api';

interface FormData {
  password: string;
  passwordConfirm: string;
  gender: string;
  birthday: Date;
  height: string;
  weight: string;
  deviceId: string;
}

interface FormErrors {
  [key: string]: string | null;
}

interface ScannedDevice {
  id: string;
  name: string | null;
}

export default function CompleteRegistration() {
  const router = useRouter();
  const { userId, email } = useLocalSearchParams<{ userId: string; email: string }>();

  // ✅ BLEContextを使用
  const {
    isConnected,
    connectedDevice,
    connectionStatus,
    startScan: bleStartScan,
    stopScan: bleStopScan,
    connect: bleConnect,
  } = useBLE();

  const [formData, setFormData] = useState<FormData>({
    password: '',
    passwordConfirm: '',
    gender: '',
    birthday: new Date(),
    height: '',
    weight: '',
    deviceId: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  const [isScanning, setIsScanning] = useState(false);
  const [scannedDevices, setScannedDevices] = useState<ScannedDevice[]>([]);
  const [showDeviceModal, setShowDeviceModal] = useState(false);

  const [debugInfo, setDebugInfo] = useState<string>('');
  const [showDebug, setShowDebug] = useState(true);

  const [bleDebugInfo, setBleDebugInfo] = useState<string>('');

  useEffect(() => {
    const checkToken = async () => {
      let log = '🔍 トークンチェック開始\n';
      setDebugInfo(log);

      try {
        const accessToken = await AsyncStorage.getItem('access_token');
        log += `✅ トークン: ${accessToken ? accessToken.substring(0, 30) + '...' : 'なし'}\n`;
        setDebugInfo(log);

        if (!accessToken) {
          log += '❌ トークンが見つかりません\n';
          setDebugInfo(log);
          Alert.alert('エラー', 'メール認証が完了していません');
          setTimeout(() => router.replace('/(auth)'), 100);
          return;
        }

        log += '📡 /auth/me/ を呼び出し中...\n';
        setDebugInfo(log);

        const response = await fetch(`${API_BASE_URL}/auth/me/`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        log += `📥 ステータスコード: ${response.status}\n`;
        setDebugInfo(log);

        if (!response.ok) {
          log += `❌ エラー: ユーザー情報の取得に失敗\n`;
          setDebugInfo(log);
          Alert.alert('エラー', `ユーザー情報の取得に失敗しました (${response.status})`);
          setTimeout(() => router.replace('/(auth)'), 100);
          return;
        }

        const userData = await response.json();

        log += ` 📊 ユーザーデータ:\n`;
        log += `  - email_verified: ${userData.email_verified}\n`;
        log += `  - is_active: ${userData.is_active}\n`;
        log += `  - gender: ${userData.gender || 'なし'}\n`;
        log += `  - birthdate: ${userData.birthdate || 'なし'}\n`;
        setDebugInfo(log);

        if (userData.gender && userData.birthdate) {
          log += '⚠️ 既に本登録済み - ホーム画面へ\n';
          setDebugInfo(log);
          Alert.alert(
            '登録済み',
            'このアカウントは既に登録が完了しています。',
            [{ text: 'OK', onPress: () => router.replace('/(app)/user-home') }]
          );
        } 
        else if (userData.is_active) {
          log += '✅ メール認証済み・本登録未完了：フォームを表示します\n';
          setDebugInfo(log);
          setIsCheckingToken(false);
        }
        else {
          log += '❌ 状態不明またはメール未認証\n';
          setDebugInfo(log);
          Alert.alert('エラー', 'メール認証が完了していません');
          router.replace('/(auth)');
        }
      } catch (error) {
        log += ` 💥 例外発生: ${error}\n`;
        setDebugInfo(log);
      }
    };

    checkToken();
  }, [userId, email, router]);

  // ✅ 接続されたデバイスをformDataに反映
  useEffect(() => {
    if (isConnected && connectedDevice) {
      updateField('deviceId', connectedDevice.id);
    }
  }, [isConnected, connectedDevice]);

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) updateField('birthday', selectedDate);
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.password || formData.password.length < 8) {
      newErrors.password = 'パスワードは8文字以上で入力してください';
    }
    
    if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = 'パスワードが一致しません';
    }
    
    if (!formData.gender) {
      newErrors.gender = '性別を選択してください';
    }
    
    if (!formData.birthday) {
      newErrors.birthday = '生年月日を入力してください';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ✅ BLEContextのstartScanを使用
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

  const stopScan = () => {
    bleStopScan();
    setIsScanning(false);
  };

  // ✅ BLEContextのconnectを使用
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

      updateField('deviceId', device.id);

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

  const handleSubmit = async () => {
    if (!validate()) {
      Alert.alert('入力エラー', '入力内容を確認してください');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const accessToken = await AsyncStorage.getItem('access_token');
      
      if (!accessToken) {
        Alert.alert('エラー', 'メール認証が完了していません。再度メール認証を行ってください。');
        router.replace('/(auth)');
        return;
      }

      const birthdayStr = formData.birthday.toISOString().split('T')[0];
      
      const requestBody = {
        password: formData.password,
        password_confirm: formData.passwordConfirm,
        gender: formData.gender,
        birthday: birthdayStr,
        height: formData.height ? parseFloat(formData.height) : null,
        weight: formData.weight ? parseFloat(formData.weight) : null,
        device_id: formData.deviceId || null,
      };

      const response = await fetch(`${API_BASE_URL}/auth/complete-registration/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await response.text();

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        Alert.alert('エラー', 'サーバーから不正なレスポンスが返されました');
        return;
      }

      if (response.ok && data.success) {
        if (data.token && data.token.access && data.token.refresh) {
          await AsyncStorage.setItem('accessToken', data.token.access);
          await AsyncStorage.setItem('refreshToken', data.token.refresh);
          
          await AsyncStorage.removeItem('access_token');
          await AsyncStorage.removeItem('refresh_token');
          await AsyncStorage.removeItem('user_id');
        }

        Alert.alert('登録完了', '本登録が完了しました', [
          { 
            text: 'OK', 
            onPress: () => router.replace('/(app)/user-home')
          },
        ]);
      } else {
        const errorMessage = data.error || data.detail || data.message || '登録に失敗しました';
        Alert.alert('エラー', errorMessage);
      }
    } catch (error: any) {
      Alert.alert('エラー', error.message || '通信エラーが発生しました');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingToken) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
        <Text style={styles.loadingText}>準備中...</Text>
        
        {debugInfo && (
          <View style={styles.debugContainer}>
            <Text style={styles.debugTitle}>🐛 デバッグ情報</Text>
            <ScrollView style={styles.debugScroll}>
              <Text style={styles.debugText}>{debugInfo}</Text>
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {showDebug && debugInfo && (
        <View style={styles.debugContainer}>
          <TouchableOpacity 
            style={styles.debugHeader}
            onPress={() => setShowDebug(!showDebug)}
          >
            <Text style={styles.debugTitle}>🐛 認証デバッグ (タップで非表示)</Text>
          </TouchableOpacity>
          <ScrollView style={styles.debugScroll}>
            <Text style={styles.debugText}>{debugInfo}</Text>
          </ScrollView>
        </View>
      )}

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

      <View style={styles.content}>
        <Text style={styles.title}>利用者新規登録</Text>
        
        {email && <Text style={styles.emailText}>登録メール: {email}</Text>}

        <View style={styles.formWrapper}>
          <View style={styles.bleStatusContainer}>
            <View style={styles.bleStatusHeader}>
              <Text style={styles.bleStatusLabel}>デバイス接続状態</Text>
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
                <Ionicons name="warning" size={16} color="#ff9800" />
                <Text style={styles.bleWarningText}>
                  デバイスが接続されていません
                </Text>
              </View>
            )}
            
            <TouchableOpacity
              style={styles.searchButton}
              onPress={startScan}
              disabled={isScanning}
            >
              <Ionicons name="bluetooth" size={18} color="white" />
              <Text style={styles.searchButtonText}>
                {isScanning ? '検索中...' : 'デバイスを検索'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>パスワード<Text style={styles.required}>必須</Text></Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.input}
                placeholder="8文字以上"
                secureTextEntry={!showPassword}
                value={formData.password}
                onChangeText={(text) => updateField('password', text)}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={24} color="#888" />
              </TouchableOpacity>
            </View>
            {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>確認用パスワード<Text style={styles.required}>必須</Text></Text>
            <View style={styles.passwordWrapper}>
              <TextInput
                style={styles.input}
                placeholder="パスワード再入力"
                secureTextEntry={!showPasswordConfirm}
                value={formData.passwordConfirm}
                onChangeText={(text) => updateField('passwordConfirm', text)}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPasswordConfirm(!showPasswordConfirm)}>
                <Ionicons name={showPasswordConfirm ? 'eye-off' : 'eye'} size={24} color="#888" />
              </TouchableOpacity>
            </View>
            {errors.passwordConfirm && <Text style={styles.errorText}>{errors.passwordConfirm}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>性別<Text style={styles.required}>必須</Text></Text>
            <View style={styles.pickerWrapper}>
              <Picker
                selectedValue={formData.gender}
                onValueChange={(value) => updateField('gender', value)}
                style={styles.picker}
              >
                <Picker.Item label="選択してください" value="" />
                <Picker.Item label="男性" value="male" />
                <Picker.Item label="女性" value="female" />
              </Picker>
            </View>
            {errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>生年月日<Text style={styles.required}>必須</Text></Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateText}>{formData.birthday.toLocaleDateString('ja-JP')}</Text>
              <Ionicons name="calendar" size={24} color="#888" />
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={formData.birthday}
                mode="date"
                display="default"
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}
            {errors.birthday && <Text style={styles.errorText}>{errors.birthday}</Text>}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>身長 (cm)</Text>
            <TextInput
              style={styles.input}
              placeholder="例: 170.5"
              keyboardType="decimal-pad"
              value={formData.height}
              onChangeText={(text) => updateField('height', text)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>体重 (kg)</Text>
            <TextInput
              style={styles.input}
              placeholder="例: 65.0"
              keyboardType="decimal-pad"
              value={formData.weight}
              onChangeText={(text) => updateField('weight', text)}
            />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>登録</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

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
              {isScanning && <ActivityIndicator size="small" color="#007bff" />}
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
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
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
    </ScrollView>
  );
}

// stylesは既存のものをそのまま使用
const styles = StyleSheet.create({
  // ... 既存のスタイルと同じ
  container: { flex: 1, backgroundColor: '#f5f6fa' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f6fa', padding: 20 },
  loadingText: { marginTop: 10, fontSize: 16, color: '#666' },
  content: { padding: 20, alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 10, textAlign: 'center' },
  emailText: { fontSize: 14, color: '#666', marginBottom: 20, textAlign: 'center' },
  formWrapper: { width: '100%', maxWidth: 600, backgroundColor: 'white', borderRadius: 10, padding: 30, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  
  bleStatusContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 8,
    marginBottom: 24,
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
    fontSize: 14,
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
    fontSize: 13,
    color: '#666',
  },
  connectedDeviceText: {
    fontSize: 13,
    color: '#28a745',
    marginBottom: 8,
    fontWeight: '500',
  },
  bleWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff3cd',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  bleWarningText: {
    fontSize: 12,
    color: '#856404',
    marginLeft: 6,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6c757d',
    padding: 12,
    borderRadius: 6,
    gap: 8,
  },
  searchButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  required: { color: '#dc3545', fontSize: 12, marginLeft: 5 },
  input: { width: '100%', padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, fontSize: 14, backgroundColor: '#fff' },
  passwordWrapper: { position: 'relative' },
  eyeIcon: { position: 'absolute', right: 12, top: 12 },
  pickerWrapper: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, overflow: 'hidden' },
  picker: { width: '100%' },
  dateButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 6, backgroundColor: '#fff' },
  dateText: { fontSize: 14, color: '#333' },
  errorText: { color: '#dc3545', fontSize: 13, marginTop: 5 },
  submitButton: { width: '100%', padding: 15, backgroundColor: '#007bff', borderRadius: 6, alignItems: 'center', marginTop: 20 },
  submitButtonDisabled: { backgroundColor: '#ccc' },
  submitButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, height: '60%', elevation: 5 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  modalSubtitle: { fontSize: 12, color: '#666', marginBottom: 15 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888' },
  deviceList: { flex: 1 },
  deviceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  deviceId: { fontSize: 12, color: '#888', marginTop: 2 },
  closeButton: { marginTop: 15, padding: 15, backgroundColor: '#eee', borderRadius: 10, alignItems: 'center' },
  closeButtonText: { color: '#333', fontWeight: 'bold' },
  
  debugContainer: {
    backgroundColor: '#1e1e1e',
    padding: 10,
    margin: 10,
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