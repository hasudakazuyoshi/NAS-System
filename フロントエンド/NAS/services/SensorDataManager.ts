// services/SensorDataManager.ts (完全版 - エラーハンドリング追加)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { postHealthData, postSleepData } from '../api/apiService';

const showNotification = (title: string, message: string) => {
  Alert.alert(title, message, [{ text: 'OK' }]);
};

// ✅ グローバルログ関数（BLEContextから注入される）
let globalLogFunction: ((message: string, type?: 'info' | 'success' | 'warning' | 'error') => void) | null = null;

// ✅ BLEContextからログ関数を受け取る初期化関数
export const initializeSensorDataManagerLogger = (
  logFunction: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
) => {
  globalLogFunction = logFunction;
};

// ✅ ログ関数（デバッグ画面に表示）
const log = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  console.log(message);  // コンソールにも出力
  if (globalLogFunction) {
    globalLogFunction(message, type);  // デバッグ画面に表示
  }
};

// ✅ timestampをDateオブジェクトに変換するヘルパー関数
const toDate = (timestamp: Date | string): Date => {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  return new Date(timestamp);
};

export interface SensorData {
  datetime: string;
  heartRate: number;
  temperature: number;
  movement: number;
  timestamp: Date;
}

interface StoredSensorData extends SensorData {
  id: string;
  sent: boolean;
  rawData: string;
  hourKey: string;
}

class SensorDataManager {
  private dataStore: StoredSensorData[] = [];
  private lastHourlySend: Date = new Date();
  private isInitialized: boolean = false;
  private initPromise: Promise<void>;

  constructor() {
    log('🚀 SensorDataManager初期化開始', 'info');
    this.initPromise = this.initialize();
    
    setInterval(() => {
      this.checkHourlyTrigger();
    }, 10 * 60 * 1000);
    
    setInterval(() => {
      this.checkNoonSleepData();
    }, 10 * 60 * 1000);
  }

  private async initialize() {
    try {
      await this.loadFromLocal();
      await this.resendUnsentData();
      this.isInitialized = true;
      log('✅ SensorDataManager初期化完了', 'success');
    } catch (error) {
      log(`❌ SensorDataManager初期化エラー: ${error}`, 'error');
      this.isInitialized = true;
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initPromise;
    }
  }

  private async loadFromLocal() {
    try {
      const storedJson = await AsyncStorage.getItem('sensorDataStore');
      if (storedJson) {
        this.dataStore = JSON.parse(storedJson);
        log(`📂 ローカルデータ読み込み: ${this.dataStore.length}件`, 'info');
        
        const sentCount = this.dataStore.filter(d => d.sent).length;
        const unsentCount = this.dataStore.filter(d => !d.sent).length;
        log(`   送信済み: ${sentCount}件, 未送信: ${unsentCount}件`, 'info');
      } else {
        log('📂 ローカルデータなし（初回起動）', 'info');
      }
    } catch (error) {
      log(`❌ ローカルデータ読み込みエラー: ${error}`, 'error');
      this.dataStore = [];
    }
  }

  private async resendUnsentData() {
    try {
      const unsentData = this.dataStore.filter(d => !d.sent);
      
      if (unsentData.length === 0) {
        log('📭 未送信データなし', 'info');
        return;
      }
      
      log(`📬 未送信データ検出: ${unsentData.length}件`, 'warning');
      
      const groupedByHour: { [key: string]: StoredSensorData[] } = {};
      
      unsentData.forEach(d => {
        const hourKey = d.hourKey || toDate(d.timestamp).toISOString().slice(0, 13);
        if (!groupedByHour[hourKey]) {
          groupedByHour[hourKey] = [];
        }
        groupedByHour[hourKey].push(d);
      });
      
      let successCount = 0;
      let failCount = 0;
      
      for (const [hourKey, dataList] of Object.entries(groupedByHour)) {
        const avgTemp = dataList.reduce((sum, d) => sum + d.temperature, 0) / dataList.length;
        const avgHR = dataList.reduce((sum, d) => sum + d.heartRate, 0) / dataList.length;
        
        const measuredTime = new Date(hourKey + ':00:00.000Z');
        
        const healthData = {
          measured_at: measuredTime.toISOString(),
          body: Math.round(avgTemp * 10) / 10,
          heart_rate: Math.round(avgHR),
        };
        
        log(`📤 未送信データ再送: ${hourKey}`, 'info');
        
        try {
          await postHealthData(healthData);
          
          dataList.forEach(d => {
            const index = this.dataStore.findIndex(stored => stored.id === d.id);
            if (index !== -1) {
              this.dataStore[index].sent = true;
            }
          });
          
          successCount++;
          log(`✅ 再送成功: ${hourKey}`, 'success');
        } catch (error) {
          failCount++;
          log(`❌ 再送失敗: ${hourKey}`, 'error');
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      await AsyncStorage.setItem(
        'sensorDataStore',
        JSON.stringify(this.dataStore)
      );
      
      log('✅ 未送信データ処理完了', 'success');
      log(`   成功: ${successCount}件, 失敗: ${failCount}件`, 'info');
      
      if (successCount > 0 || failCount > 0) {
        showNotification(
          '未送信データ処理完了',
          `成功: ${successCount}件\n失敗: ${failCount}件`
        );
      }
    } catch (error) {
      log(`❌ 未送信データ再送エラー: ${error}`, 'error');
      showNotification('エラー', '未送信データの再送に失敗しました');
    }
  }

  async onDataReceived(data: SensorData, rawData: string): Promise<number> {
    try {
      log(`📥 データ受信: HR=${data.heartRate}, TEMP=${data.temperature}, MOV=${data.movement}`, 'info');
      
      await this.ensureInitialized();
      await this.saveToLocal(data, rawData);
      
      const unsentCount = this.dataStore.filter(d => !d.sent).length;
      log(`✅ データ処理完了 (未送信: ${unsentCount}件)`, 'success');
      
      return unsentCount;
    } catch (error) {
      log(`❌ onDataReceived エラー: ${error}`, 'error');
      return 0;
    }
  }

  async sendHourlyAverage() {
    try {
      await this.ensureInitialized();
      
      const previousHour = new Date();
      previousHour.setHours(previousHour.getHours() - 1);
      const hourKey = previousHour.toISOString().slice(0, 13);
      
      log(`📊 時間帯データ集計中: ${hourKey}`, 'info');
      
      const hourData = this.dataStore.filter(d => 
        d.hourKey === hourKey && !d.sent
      );
      
      if (hourData.length === 0) {
        log('⚠️ 送信するデータがありません', 'warning');
        return;
      }
      
      log(`   対象データ: ${hourData.length}件`, 'info');
      
      const avgTemp = hourData.reduce((sum, d) => sum + d.temperature, 0) / hourData.length;
      const avgHR = hourData.reduce((sum, d) => sum + d.heartRate, 0) / hourData.length;

      const healthData = {
        measured_at: new Date(hourKey + ':00:00.000Z').toISOString(),
        body: Math.round(avgTemp * 10) / 10,
        heart_rate: Math.round(avgHR),
      };

      log('📤 健康データを送信', 'info');
      await postHealthData(healthData);

      hourData.forEach(d => {
        const index = this.dataStore.findIndex(stored => stored.id === d.id);
        if (index !== -1) {
          this.dataStore[index].sent = true;
        }
      });
      
      await AsyncStorage.setItem(
        'sensorDataStore',
        JSON.stringify(this.dataStore)
      );

      this.lastHourlySend = new Date();
      
      log('✅ 1時間分のデータ送信完了', 'success');
      log(`   送信済みフラグ更新: ${hourData.length}件`, 'info');
      
      showNotification(
        '健康データ送信完了',
        `${previousHour.getHours()}時の平均データを送信しました\n体温: ${healthData.body}℃\n心拍数: ${healthData.heart_rate}bpm`
      );
    } catch (error) {
      log(`❌ データ送信エラー: ${error}`, 'error');
      showNotification('エラー', '健康データの送信に失敗しました');
    }
  }

  async sendDailySleepData() {
    try {
      await this.ensureInitialized();
      
      const yesterdayData = await this.getYesterdayData();
      
      if (yesterdayData.length === 0) {
        log('⚠️ 昨日のデータがありません', 'warning');
        showNotification('通知', '昨日の睡眠データがありません');
        return;
      }

      log(`😴 睡眠判定開始（昨日分）: ${yesterdayData.length}件`, 'info');

      const sleepInfo = this.calculateSleep(yesterdayData);

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const sleepData = {
        date: yesterday.toISOString().split('T')[0],
        sleep_hours: sleepInfo.total_sleep_hours,
      };

      log('📤 睡眠データを送信', 'info');
      await postSleepData(sleepData);

      log('✅ 睡眠データ送信完了', 'success');
      
      showNotification(
        '睡眠データ送信完了',
        `昨日の睡眠時間: ${sleepInfo.total_sleep_hours}時間\n睡眠の質: ${sleepInfo.sleep_quality === 'good' ? '良好' : '改善が必要'}`
      );
    } catch (error) {
      log(`❌ 睡眠データ送信エラー: ${error}`, 'error');
      showNotification('エラー', '睡眠データの送信に失敗しました');
    }
  }

  private calculateSleep(data: StoredSensorData[]) {
    const sleepPeriods: { start: Date; end: Date; quality: string }[] = [];
    let currentSleepStart: Date | null = null;

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      
      const isSleeping = 
        d.heartRate >= 50 && d.heartRate <= 70 &&
        d.movement < 0.7;

      if (isSleeping && !currentSleepStart) {
        currentSleepStart = toDate(d.timestamp);  // ✅ 修正
      } else if (!isSleeping && currentSleepStart) {
        sleepPeriods.push({
          start: currentSleepStart,
          end: toDate(d.timestamp),  // ✅ 修正
          quality: 'good',
        });
        currentSleepStart = null;
      }
    }

    const totalSleepMinutes = sleepPeriods.reduce((sum, period) => {
      const duration = (period.end.getTime() - period.start.getTime()) / (1000 * 60);
      return sum + duration;
    }, 0);

    return {
      sleep_periods: sleepPeriods,
      total_sleep_hours: Math.round((totalSleepMinutes / 60) * 100) / 100,
      sleep_quality: totalSleepMinutes >= 360 ? 'good' : 'poor',
    };
  }

  private async saveToLocal(data: SensorData, rawData: string) {
    log('🔵 saveToLocal 開始', 'info');
    
    try {
      log(`🔵 受信データ: datetime="${data.datetime}"`, 'info');
      
      // ✅ timestampをDateオブジェクトに変換（文字列の場合も対応）
      let dataTime: Date;
      
      if (data.timestamp instanceof Date) {
        // すでにDateオブジェクト
        dataTime = data.timestamp;
        log(`🔵 timestamp はDateオブジェクト`, 'info');
      } else if (typeof data.timestamp === 'string') {
        // 文字列の場合はDateに変換
        log(`🔵 timestamp は文字列、変換します: ${data.timestamp}`, 'info');
        dataTime = new Date(data.timestamp);
      } else {
        // timestampがない場合はdatetimeから
        log(`🔵 timestamp がない、datetimeから生成: ${data.datetime}`, 'info');
        dataTime = new Date(data.datetime);
      }
      
      // バリデーション
      if (isNaN(dataTime.getTime())) {
        log(`⚠️ 無効な日付、現在時刻を使用`, 'warning');
        dataTime = new Date();
      }
      
      const hourKey = dataTime.toISOString().slice(0, 13);
      log(`🔵 hourKey生成完了: ${hourKey}`, 'info');
      
      log('🔵 storedData作成前', 'info');
      const storedData: StoredSensorData = {
        ...data,
        timestamp: dataTime, // ✅ 検証済みのDateオブジェクト
        id: `${Date.now()}_${Math.random()}`,
        sent: false,
        rawData: rawData,
        hourKey: hourKey,
      };
      log('🔵 storedData作成完了', 'info');

      log(`🔵 dataStore.push前, 現在の件数: ${this.dataStore.length}`, 'info');
      this.dataStore.push(storedData);
      log(`🔵 dataStore.push後, 現在の件数: ${this.dataStore.length}`, 'info');

      log('🔵 古いデータ削除前', 'info');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const beforeLength = this.dataStore.length;
      this.dataStore = this.dataStore.filter(d => 
        toDate(d.timestamp) > sevenDaysAgo
      );
      log(`🔵 古いデータ削除後: ${beforeLength} → ${this.dataStore.length}`, 'info');

      log('🔵 AsyncStorage.setItem前', 'info');
      await AsyncStorage.setItem(
        'sensorDataStore',
        JSON.stringify(this.dataStore)
      );
      log('🔵 AsyncStorage.setItem完了', 'success');
      
      const unsentCount = this.dataStore.filter(d => !d.sent).length;
      log(`💾 ローカル保存完了: ${this.dataStore.length}件`, 'success');
      log(`   hourKey: ${hourKey}, sent: false`, 'info');
      log(`   現在の未送信件数: ${unsentCount}件`, 'info');
    } catch (error) {
      log(`❌❌❌ saveToLocal エラー: ${error}`, 'error');
      throw error;
    }
  }

  private async getTodayData(): Promise<StoredSensorData[]> {
    try {
      const today = new Date().toISOString().split('T')[0];
      return this.dataStore.filter(d => {
        const dataDate = toDate(d.timestamp).toISOString().split('T')[0];
        return dataDate === today;
      });
    } catch (error) {
      log(`❌ データ取得エラー: ${error}`, 'error');
      return [];
    }
  }

  private async getYesterdayData(): Promise<StoredSensorData[]> {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      return this.dataStore.filter(d => {
        const dataDate = toDate(d.timestamp).toISOString().split('T')[0];
        return dataDate === yesterdayStr;
      });
    } catch (error) {
      log(`❌ データ取得エラー: ${error}`, 'error');
      return [];
    }
  }

  checkNoonSleepData() {
    const now = new Date();
    
    if (now.getHours() === 12 && now.getMinutes() < 10) {
      log('🕛 正午12時: 昨日の睡眠データを送信開始', 'info');
      this.sendDailySleepData().catch(err => {
        log(`❌ 睡眠データ送信エラー: ${err}`, 'error');
      });
    }
  }

  checkHourlyTrigger() {
    const now = new Date();
    const currentMinute = now.getMinutes();
    const currentHour = now.getHours();
    const lastSendHour = this.lastHourlySend.getHours();
    const lastSendDate = this.lastHourlySend.toDateString();
    const currentDate = now.toDateString();
    
    const isHourlyWindow = currentMinute < 10;
    const hourChanged = (currentDate !== lastSendDate) || (currentHour !== lastSendHour);
    
    const previousHour = new Date();
    previousHour.setHours(previousHour.getHours() - 1);
    const hourKey = previousHour.toISOString().slice(0, 13);
    const hasUnsentData = this.dataStore.some(d => 
      d.hourKey === hourKey && !d.sent
    );
    
    if (isHourlyWindow && hourChanged && hasUnsentData) {
      log(`⏰ ${currentHour}時00分: 前時間帯(${previousHour.getHours()}時)のデータを送信開始`, 'info');
      this.sendHourlyAverage().catch(err => {
        log(`❌ 時間平均送信エラー: ${err}`, 'error');
      });
    }
  }

  getStats() {
    const sentCount = this.dataStore.filter(d => d.sent).length;
    const unsentCount = this.dataStore.filter(d => !d.sent).length;
    
    return {
      totalRecords: this.dataStore.length,
      sentRecords: sentCount,
      unsentRecords: unsentCount,
      lastSend: this.lastHourlySend,
      isInitialized: this.isInitialized,
    };
  }
  
  getUnsentDetails() {
    const unsentData = this.dataStore.filter(d => !d.sent);
    const groupedByHour: { [key: string]: number } = {};
    
    unsentData.forEach(d => {
      if (!groupedByHour[d.hourKey]) {
        groupedByHour[d.hourKey] = 0;
      }
      groupedByHour[d.hourKey]++;
    });
    
    return {
      total: unsentData.length,
      byHour: groupedByHour,
      details: unsentData.map(d => ({
        id: d.id,
        datetime: d.datetime,
        hourKey: d.hourKey,
        sent: d.sent,
      })),
    };
  }

  async getUnsentDataCount(): Promise<number> {
    await this.ensureInitialized();
    return this.dataStore.filter(d => !d.sent).length;
  }

  async checkAndResendUnsentData(): Promise<{ success: boolean; successCount: number; failCount: number }> {
    try {
      await this.ensureInitialized();
      
      const unsentData = this.dataStore.filter(d => !d.sent);
      
      if (unsentData.length === 0) {
        return { success: true, successCount: 0, failCount: 0 };
      }
      
      const groupedByHour: { [key: string]: StoredSensorData[] } = {};
      
      unsentData.forEach(d => {
        const hourKey = d.hourKey || toDate(d.timestamp).toISOString().slice(0, 13);
        if (!groupedByHour[hourKey]) {
          groupedByHour[hourKey] = [];
        }
        groupedByHour[hourKey].push(d);
      });
      
      let successCount = 0;
      let failCount = 0;
      
      for (const [hourKey, dataList] of Object.entries(groupedByHour)) {
        const avgTemp = dataList.reduce((sum, d) => sum + d.temperature, 0) / dataList.length;
        const avgHR = dataList.reduce((sum, d) => sum + d.heartRate, 0) / dataList.length;
        
        const healthData = {
          measured_at: new Date(hourKey + ':00:00.000Z').toISOString(),
          body: Math.round(avgTemp * 10) / 10,
          heart_rate: Math.round(avgHR),
        };
        
        try {
          await postHealthData(healthData);
          
          dataList.forEach(d => {
            const index = this.dataStore.findIndex(stored => stored.id === d.id);
            if (index !== -1) {
              this.dataStore[index].sent = true;
            }
          });
          
          successCount++;
        } catch (error) {
          failCount++;
          log(`❌ 送信失敗: ${hourKey}`, 'error');
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      await AsyncStorage.setItem('sensorDataStore', JSON.stringify(this.dataStore));
      
      return { success: true, successCount, failCount };
    } catch (error) {
      log(`❌ checkAndResendUnsentData エラー: ${error}`, 'error');
      return { success: false, successCount: 0, failCount: 0 };
    }
  }
}

export default new SensorDataManager();