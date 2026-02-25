import { Feather } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
// @ts-ignore
import { getWeeklyHealthData } from '../../api/apiService';
import { useBLE } from '../../context/BLEContext';

const { width } = Dimensions.get('window');
const CHART_WIDTH = Math.min(width * 0.9, 400);

// ✅ nullを許容する型（インデックス保持のため）
type DataEntry = {
  label: string;
  labels: string[];
  tempData: (number | null)[];
  hrData: (number | null)[];
};

const initialDataStructure: Record<string, DataEntry> = {
  thisWeek:      { label: "今週",     labels: ['日','月','火','水','木','金','土'], tempData: [], hrData: [] },
  oneWeekAgo:    { label: "一週間前", labels: ['日','月','火','水','木','金','土'], tempData: [], hrData: [] },
  twoWeeksAgo:   { label: "二週間前", labels: ['日','月','火','水','木','金','土'], tempData: [], hrData: [] },
  threeWeeksAgo: { label: "三週間前", labels: ['日','月','火','水','木','金','土'], tempData: [], hrData: [] },
  fourWeeksAgo:  { label: "四週間前", labels: ['1週目','2週目','3週目','4週目'],   tempData: [], hrData: [] },
};

type DataPeriod = keyof typeof initialDataStructure;

const parseDateTime = (datetime: string | undefined | null): Date | null => {
  if (!datetime) return null;
  const normalized = datetime.replace(' ', 'T');
  const date = new Date(normalized);
  return isNaN(date.getTime()) ? null : date;
};

export default function HeartRateScreen() {
  const [dataPeriod, setDataPeriod] = useState<DataPeriod>('thisWeek');
  const [displayData, setDisplayData] = useState<DataEntry>(initialDataStructure['thisWeek']);
  const [isLoading, setIsLoading] = useState(false);

  const { isConnected, connectedDevice, lastReceivedData } = useBLE();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const preset = initialDataStructure[dataPeriod];
    try {
      const weeksMap: Record<string, number> = {
        'thisWeek': 0, 'oneWeekAgo': 1, 'twoWeeksAgo': 2,
        'threeWeeksAgo': 3, 'fourWeeksAgo': 4,
      };
      const apiData = await getWeeklyHealthData(weeksMap[dataPeriod] || 0);

      // ✅ nullを除外せずインデックスを保持
      const rawTemp: (number | null)[] = (apiData.temperature || [])
        .map((v: number | null) => (v !== null && v > 0 ? v : null));
      const rawHr: (number | null)[] = (apiData.heart_rate || [])
        .map((v: number | null) => (v !== null && v > 0 ? v : null));

      setDisplayData({
        label: preset.label,
        labels: apiData.labels || preset.labels,
        tempData: rawTemp,
        hrData: rawHr,
      });
    } catch (e) {
      console.error('❌ 通信エラー:', e);
      setDisplayData(preset);
    } finally {
      setIsLoading(false);
    }
  }, [dataPeriod]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const avg = (arr: (number | null)[]) => {
    const valid = arr.filter((v): v is number => v !== null);
    return valid.length === 0 ? 0 : valid.reduce((a, b) => a + b, 0) / valid.length;
  };

  const avgTemp = useMemo(() => avg(displayData.tempData), [displayData]);
  const avgHr   = useMemo(() => avg(displayData.hrData),   [displayData]);

  const hasHrData   = useMemo(() => displayData.hrData.some(v => v !== null),   [displayData]);
  const hasTempData = useMemo(() => displayData.tempData.some(v => v !== null), [displayData]);
  const hasData = hasHrData || hasTempData;

  // ✅ chart-kit用：nullを0で埋めてラベルと合わせる
  const hrChartData = useMemo(() => ({
    labels: displayData.labels,
    datasets: [{
      data: displayData.hrData.map(v => v ?? 0),
      color: (opacity = 1) => `rgba(255, 130, 0, ${opacity})`,
      strokeWidth: 2,
    }],
  }), [displayData]);

  const tempChartData = useMemo(() => ({
    labels: displayData.labels,
    datasets: [{
      data: displayData.tempData.map(v => v ?? 0),
      color: (opacity = 1) => `rgba(75, 120, 255, ${opacity})`,
      strokeWidth: 2,
    }],
  }), [displayData]);

  const formattedTime = useMemo(() => {
    if (!lastReceivedData?.datetime) return null;
    const date = parseDateTime(lastReceivedData.datetime);
    return date ? date.toLocaleTimeString('ja-JP') : null;
  }, [lastReceivedData?.datetime]);

  // chart-kit共通設定
  const baseChartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 1,
    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity * 0.6})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity * 0.6})`,
    propsForDots: { r: '4', strokeWidth: '2' },
    propsForLabels: { fontSize: 10 },
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>

      {/* ヘッダーバー */}
      <View style={styles.headerBar}>
        <View style={styles.connectionBadge}>
          <Feather name="bluetooth" size={14} color={isConnected ? '#4a90e2' : '#999'} />
          <Text style={[styles.connectionText, { color: isConnected ? '#4a90e2' : '#999' }]}>
            {isConnected ? `${connectedDevice?.name || 'デバイス'} 接続中` : 'デバイス未接続'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchData} disabled={isLoading}>
          <Feather name="refresh-cw" size={18} color={isLoading ? '#ccc' : '#4a90e2'} />
          <Text style={[styles.refreshText, { color: isLoading ? '#ccc' : '#4a90e2' }]}>更新</Text>
        </TouchableOpacity>
      </View>

      {/* リアルタイムカード */}
      <View style={styles.liveCard}>
        <View style={styles.liveHeader}>
          {isConnected && (
            <View style={styles.liveIndicator}>
              <View style={styles.pulseDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          <Text style={styles.liveTitle}>
            {isConnected ? '現在の測定値' : 'デバイス未接続'}
          </Text>
        </View>

        {isConnected && lastReceivedData ? (
          <View>
            <View style={styles.liveDataRow}>
              <View style={styles.liveDataItem}>
                <Feather name="heart" size={22} color="#FF8200" />
                <Text style={styles.liveDataLabel}>心拍数</Text>
                <Text style={[styles.liveDataValue, { color: '#FF8200' }]}>
                  {lastReceivedData.heartRate} bpm
                </Text>
              </View>
              <View style={styles.liveDataItem}>
                <Feather name="thermometer" size={22} color="#4B78FF" />
                <Text style={styles.liveDataLabel}>体温</Text>
                <Text style={[styles.liveDataValue, { color: '#4B78FF' }]}>
                  {lastReceivedData.temperature.toFixed(1)}°C
                </Text>
              </View>
              <View style={styles.liveDataItem}>
                <Feather name="activity" size={22} color="#9b59b6" />
                <Text style={styles.liveDataLabel}>動き</Text>
                <Text style={[styles.liveDataValue, { color: '#9b59b6' }]}>
                  {lastReceivedData.movement.toFixed(1)}
                </Text>
              </View>
            </View>
            {formattedTime && (
              <Text style={styles.liveTimestamp}>最終更新: {formattedTime}</Text>
            )}
          </View>
        ) : (
          <View style={styles.liveNoDataContainer}>
            <Feather name="bluetooth" size={40} color="#ccc" />
            <Text style={styles.liveNoDataText}>
              {isConnected ? 'データ受信待機中...' : 'デバイスを接続してください'}
            </Text>
          </View>
        )}
      </View>

      {/* 区切り線 */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>週間データ</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* 期間選択 */}
      <View style={styles.periodSelectorContainer}>
        <Text style={styles.periodLabel}>{displayData.label}</Text>
        <View style={styles.pickerWrapper}>
          <Picker
            selectedValue={dataPeriod}
            onValueChange={(v) => setDataPeriod(v as DataPeriod)}
            style={styles.periodSelect}
            enabled={!isLoading}
          >
            {Object.keys(initialDataStructure).map(key => (
              <Picker.Item
                key={key}
                label={initialDataStructure[key as DataPeriod].label}
                value={key}
              />
            ))}
          </Picker>
        </View>
      </View>

      {/* グラフエリア */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={{ marginTop: 10, color: '#777' }}>データ読み込み中...</Text>
        </View>
      ) : !hasData ? (
        <View style={styles.noDataContainer}>
          <Feather name="bar-chart-2" size={40} color="#ccc" />
          <Text style={styles.noDataText}>表示するデータがありません</Text>
          <Text style={styles.noDataSubText}>測定データを入力してください</Text>
        </View>
      ) : (
        <>
          {/* 心拍数グラフ */}
          {hasHrData && (
            <View style={styles.chartArea}>
              <View style={styles.chartTitleRow}>
                <View style={[styles.chartTitleDot, { backgroundColor: '#FF8200' }]} />
                <Text style={styles.graphTitle}>心拍数</Text>
                <Text style={styles.chartUnit}>(bpm)</Text>
              </View>
              <LineChart
                data={hrChartData}
                width={CHART_WIDTH - 20}
                height={180}
                yAxisLabel=""
                yAxisSuffix=""
                chartConfig={{
                  ...baseChartConfig,
                  color: (opacity = 1) => `rgba(255, 130, 0, ${opacity})`,
                  propsForDots: { r: '4', strokeWidth: '2', stroke: '#FF8200' },
                }}
                bezier
                style={styles.chartStyle}
                fromZero={false}
              />
              <Text style={[styles.averageText, { color: '#FF8200' }]}>
                週平均: {avgHr > 0 ? `${Math.round(avgHr)} bpm` : '--'}
              </Text>
            </View>
          )}

          {/* 体温グラフ */}
          {hasTempData && (
            <View style={styles.chartArea}>
              <View style={styles.chartTitleRow}>
                <View style={[styles.chartTitleDot, { backgroundColor: '#4B78FF' }]} />
                <Text style={styles.graphTitle}>体温</Text>
                <Text style={styles.chartUnit}>(°C)</Text>
              </View>
              <LineChart
                data={tempChartData}
                width={CHART_WIDTH - 20}
                height={180}
                yAxisLabel=""
                yAxisSuffix="°"
                chartConfig={{
                  ...baseChartConfig,
                  color: (opacity = 1) => `rgba(75, 120, 255, ${opacity})`,
                  propsForDots: { r: '4', strokeWidth: '2', stroke: '#4B78FF' },
                  decimalPlaces: 1,
                }}
                bezier
                style={styles.chartStyle}
                fromZero={false}
              />
              <Text style={[styles.averageText, { color: '#4B78FF' }]}>
                週平均: {avgTemp > 0 ? `${avgTemp.toFixed(1)}°C` : '--'}
              </Text>
            </View>
          )}
        </>
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
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
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
  connectionText: { fontSize: 12, fontWeight: '600' },
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
  refreshText: { fontSize: 12, fontWeight: '600' },
  liveCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#4a90e2',
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff0000',
    marginRight: 5,
  },
  liveText: { color: '#ff0000', fontSize: 12, fontWeight: 'bold' },
  liveTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  liveDataRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  liveDataItem: { alignItems: 'center', gap: 3 },
  liveDataLabel: { fontSize: 11, color: '#666', marginTop: 3 },
  liveDataValue: { fontSize: 18, fontWeight: 'bold' },
  liveTimestamp: { fontSize: 11, color: '#999', textAlign: 'center', marginTop: 4 },
  liveNoDataContainer: { alignItems: 'center', paddingVertical: 16 },
  liveNoDataText: { fontSize: 13, color: '#999', marginTop: 10 },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { paddingHorizontal: 12, fontSize: 13, fontWeight: '600', color: '#666' },
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
    overflow: 'hidden',
    backgroundColor: 'white',
  },
  periodSelect: { width: '100%', height: 40 },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    width: '100%',
  },
  noDataText: { fontSize: 16, color: '#777', textAlign: 'center', marginTop: 12, marginBottom: 6 },
  noDataSubText: { fontSize: 14, color: '#999', textAlign: 'center' },
  chartArea: {
    width: '100%',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#757575',
    borderRadius: 6,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  chartTitleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  graphTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  chartUnit: {
    fontSize: 13,
    color: '#888',
    marginLeft: 2,
  },
  chartStyle: {
    borderRadius: 4,
  },
  averageText: {
    width: '100%',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
});