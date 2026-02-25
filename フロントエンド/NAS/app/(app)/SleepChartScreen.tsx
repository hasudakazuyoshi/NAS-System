import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
// @ts-ignore
import { getWeeklySleepData } from '../../api/apiService';
import { useBLE } from '../../context/BLEContext';

const { width } = Dimensions.get('window');
const CHART_WIDTH = Math.min(width * 0.9, 400);

type SleepDataEntry = {
  label: string;
  labels: string[];
  data: number[];
};

const initialSleepData: Record<string, SleepDataEntry> = {
  thisWeek: { label: "今週", labels: ['日', '月', '火', '水', '木', '金', '土'], data: [] },
  oneWeekAgo: { label: "一週間前", labels: ['日', '月', '火', '水', '木', '金', '土'], data: [] },
  twoWeeksAgo: { label: "二週間前", labels: ['日', '月', '火', '水', '木', '金', '土'], data: [] },
  threeWeeksAgo: { label: "三週間前", labels: ['日', '月', '火', '水', '木', '金', '土'], data: [] },
  fourWeeksAgo: { label: "四週間前", labels: ['1週目', '2週目', '3週目', '4週目'], data: [] },
};

type DataPeriod = keyof typeof initialSleepData;

export default function SleepChartScreen() {
  const [dataPeriod, setDataPeriod] = useState<DataPeriod>('thisWeek');
  const [displayData, setDisplayData] = useState<SleepDataEntry>(initialSleepData['thisWeek']);
  const [isLoading, setIsLoading] = useState(false);

  // ✅ BLEの接続状態のみ取得（表示用）
  const { isConnected, connectedDevice } = useBLE();

  // ✅ データ取得処理を関数化
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const preset = initialSleepData[dataPeriod];

    try {
      const weeksMap: Record<string, number> = {
        'thisWeek': 0,
        'oneWeekAgo': 1,
        'twoWeeksAgo': 2,
        'threeWeeksAgo': 3,
        'fourWeeksAgo': 4,
      };
      const weeksAgo = weeksMap[dataPeriod] || 0;
      const apiData = await getWeeklySleepData(weeksAgo);

      console.log('📦 取得した睡眠データ:', apiData);

      const cleanData = (apiData.sleep_hours || [])
        .map((val: number | null) => val !== null && val > 0 ? val : null)
        .filter((val: number | null) => val !== null) as number[];

      setDisplayData({
        label: preset.label,
        labels: apiData.labels || preset.labels,
        data: cleanData
      });

    } catch (error) {
      console.error("❌ 通信エラー:", error);
      setDisplayData(preset);
    } finally {
      setIsLoading(false);
    }
  }, [dataPeriod]);

  // ✅ 画面フォーカス時に自動更新
  useFocusEffect(
    useCallback(() => {
      console.log('📱 画面フォーカス - データ取得');
      fetchData();
    }, [fetchData])
  );

  const averageSleep = useMemo(() => {
    if (displayData.data.length === 0) return '平均睡眠時間: --時間--分';
    
    const sum = displayData.data.reduce((a, b) => a + b, 0);
    const avgHours = sum / displayData.data.length;
    const hours = Math.floor(avgHours);
    const minutes = Math.round((avgHours - hours) * 60);

    return `平均睡眠時間: ${hours}時間${minutes}分`;
  }, [displayData]);

  const [characterMessage, setCharacterMessage] = useState('');
  useEffect(() => {
    const messages = [
      '今日も一日お疲れ様です！',
      '適度な運動も睡眠には大切ですよ。',
      'ぐっすり眠れていますか？',
      '良い睡眠は健康の基本です。',
    ];
    const randomIndex = Math.floor(Math.random() * messages.length);
    setCharacterMessage(messages[randomIndex]);
  }, [dataPeriod]);

  const hasData = displayData.data.length > 0;

  const chartData = useMemo(() => {
    if (!hasData) {
      return {
        labels: displayData.labels,
        datasets: [{
          data: [0],
        }]
      };
    }

    return {
      labels: displayData.labels,
      datasets: [{ data: displayData.data }]
    };
  }, [displayData, hasData]);

  const NoDataMessage = () => (
    <View style={styles.noDataContainer}>
      <Text style={styles.noDataText}>表示するデータがありません</Text>
      <Text style={styles.noDataSubText}>睡眠データを入力してください</Text>
    </View>
  );

  // ✅ 接続状態バッジ + 更新ボタン
  const HeaderBar = () => (
    <View style={styles.headerBar}>
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

      <TouchableOpacity 
        style={styles.refreshButton}
        onPress={fetchData}
        disabled={isLoading}
      >
        <Feather 
          name="refresh-cw" 
          size={18} 
          color={isLoading ? "#ccc" : "#FF6699"} 
        />
        <Text style={[
          styles.refreshText,
          { color: isLoading ? "#ccc" : "#FF6699" }
        ]}>
          更新
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      
      {/* ✅ ヘッダーバー */}
      <HeaderBar />

      <View style={styles.messageBox}>
        <Text style={styles.messageTextCenter}>{characterMessage}</Text>
      </View>

      <View style={styles.periodSelectorContainer}>
        <Text style={styles.periodLabel}>{displayData.label}</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={dataPeriod}
            onValueChange={(itemValue) => setDataPeriod(itemValue as DataPeriod)}
            style={styles.periodSelect}
            enabled={!isLoading}
          >
            <Picker.Item label="今週" value="thisWeek" />
            <Picker.Item label="一週間前" value="oneWeekAgo" />
            <Picker.Item label="二週間前" value="twoWeeksAgo" />
            <Picker.Item label="三週間前" value="threeWeeksAgo" />
            <Picker.Item label="四週間前" value="fourWeeksAgo" />
          </Picker>
        </View>
      </View>

      <View style={styles.chartArea}>
        <Text style={styles.graphTitle}>睡眠時間</Text>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#FF6699" />
            <Text style={{marginTop: 10, color: '#777'}}>読み込み中...</Text>
          </View>
        ) : hasData ? (
          <BarChart
            data={chartData}
            width={CHART_WIDTH - 40}
            height={220}
            yAxisLabel=""
            yAxisSuffix="h"
            chartConfig={{
              backgroundColor: '#ffffff',
              backgroundGradientFrom: '#ffffff',
              backgroundGradientTo: '#ffffff',
              decimalPlaces: 1,
              color: (opacity = 1) => `rgba(255, 102, 153, ${opacity})`, 
              labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity * 0.7})`,
              barPercentage: 0.6,
            }}
            style={styles.chartStyle}
            showValuesOnTopOfBars={true}
          />
        ) : (
          <NoDataMessage />
        )}
      </View>
      
      {hasData && (
        <Text style={styles.averageText}>{averageSleep}</Text>
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 10,
    paddingTop: 0,
    backgroundColor: '#FEF1E7',
    maxWidth: 420,
    alignSelf: 'center',
  },
  // ✅ ヘッダーバー
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  // ✅ 接続状態バッジ（左寄せ）
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // ✅ 更新ボタン
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  refreshText: {
    fontSize: 12,
    fontWeight: '600',
  },
  messageBox: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  messageTextCenter: { fontSize: 15, color: '#333' },
  periodSelectorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  periodLabel: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  pickerWrapper: {
    borderColor: '#ccc', 
    borderWidth: 1, 
    borderRadius: 4,
    height: 40, 
    width: 130, 
    justifyContent: 'center', 
    backgroundColor: 'white',
    overflow: 'hidden',
  },
  periodSelect: { width: '100%', height: 40 },
  chartArea: {
    width: '100%',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#757575',
    borderRadius: 6,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
    minHeight: 300,
  },
  graphTitle: {
    textAlign: 'center', 
    fontSize: 22, 
    fontWeight: 'bold',
    marginBottom: 15, 
    color: '#333',
  },
  chartStyle: { borderRadius: 0, marginRight: 10 },
  noDataContainer: {
    alignItems: 'center', 
    justifyContent: 'center',
    height: 200, 
    width: CHART_WIDTH - 40,
  },
  loadingContainer: {
    height: 200,
    width: CHART_WIDTH - 40,
    justifyContent: 'center', 
    alignItems: 'center',
  },
  noDataText: { 
    fontSize: 16, 
    color: '#777',
    marginBottom: 8,
  },
  noDataSubText: {
    fontSize: 14,
    color: '#999',
  },
  averageText: {
    width: '100%', 
    textAlign: 'center', 
    fontSize: 20, 
    fontWeight: 'bold',
    color: '#333', 
    marginBottom: 20,
  },
});