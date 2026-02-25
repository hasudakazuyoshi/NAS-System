import { useEffect, useMemo, useState } from 'react';
// ⭐ 変更点：同じ /API/ フォルダにある BleDataProcessor をインポート
import { setDataCallback, startBleProcess } from './BleDataProcessor';

const initialData = {
    t: null, // 体温 (Temperature)
    h: null, // 心拍数 (Heart Rate)
    s: null, // 睡眠/活動
    timestamp: null, 
};

/**
 * リアルタイムのウェアラブルデバイスデータを管理・提供するカスタムフック
 */
export const useWearableData = () => {
    // 1. 最新データのみを保持
    const [currentData, setCurrentData] = useState(initialData);

    // 2. リアルタイムデータの履歴 (過去1分間の移動平均用)
    const [recentLog, setRecentLog] = useState([]);
    
    // データがプッシュされるたびに呼び出される関数
    const handleNewData = (newData) => {
        // ⭐ 心拍がnull/0でも動作するようにチェックを強化
        if (!newData || (newData.t === null && newData.h === null)) {
             // データが無効な場合は無視
             return;
        }

        const dataWithTimestamp = {
            ...newData,
            // 心拍センサー未完成でもアプリがクラッシュしないように、hがない場合はnullに設定
            h: newData.h || null, 
            timestamp: Date.now(), 
        };

        // 最新データを更新
        setCurrentData(dataWithTimestamp);

        // 移動平均のためにログを更新
        setRecentLog(prevLog => {
            const now = Date.now();
            const filteredLog = prevLog.filter(item => now - item.timestamp < 60000); // 過去60秒
            return [...filteredLog, dataWithTimestamp];
        });
        
        // ⭐ BLEデータ取得確認用のログ (Step 3の確認に使用)
        console.log('🚀 useWearableData 受信:', dataWithTimestamp); 
    };

    // 3. リアルタイムで必要な計算を useMemo で行う (体温/心拍がnullでも計算できるように調整)
    const calculatedRealtimeData = useMemo(() => {
        if (recentLog.length === 0) {
            return { lastMinuteAvgHr: null, lastMinuteAvgTemp: null };
        }
        
        // 体温の計算
        const tempLogs = recentLog.filter(item => item.t !== null);
        const totalTemp = tempLogs.reduce((sum, item) => sum + (item.t || 0), 0);
        const lastMinuteAvgTemp = tempLogs.length > 0 ? totalTemp / tempLogs.length : null;

        // 心拍の計算
        const hrLogs = recentLog.filter(item => item.h !== null);
        const totalHr = hrLogs.reduce((sum, item) => sum + (item.h || 0), 0);
        const lastMinuteAvgHr = hrLogs.length > 0 ? totalHr / hrLogs.length : null;

        return {
            lastMinuteAvgHr: lastMinuteAvgHr ? Math.round(lastMinuteAvgHr) : null,
            lastMinuteAvgTemp: lastMinuteAvgTemp ? lastMinuteAvgTemp.toFixed(1) : null,
        };

    }, [recentLog]); 

    useEffect(() => {
        setDataCallback(handleNewData);
        startBleProcess(); 
        
        return () => {
            // クリーンアップロジック
        };
    }, []); 

    return {
        currentData, 
        ...calculatedRealtimeData, 
    };
};