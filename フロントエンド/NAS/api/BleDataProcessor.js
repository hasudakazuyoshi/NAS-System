import { Buffer } from 'buffer'; // Base64デコードに必要
import { BleManager } from 'react-native-ble-plx';

// ★★★ ESP32の情報を正確に定義 ★★★
const DEVICE_NAME = 'ESP32_MAX30205';

// 体温サービスとキャラクタリスティックのUUID
const SERVICE_UUID = '19B10000-E8F2-537E-4F6C-D104768A1214';
const TEMP_CHARACTERISTIC_UUID = '19B10001-E8F2-537E-4F6C-D104768A1214';

const manager = new BleManager();

// useWearableData.jsフックにデータを渡すためのコールバック関数
let dataCallback = null;

/**
 * 外部のフックからデータ受信用のコールバック関数を登録する
 * @param {function} callback - 受信したJSONオブジェクトを渡す関数
 */
export const setDataCallback = (callback) => {
    dataCallback = callback;
};

/**
 * 受信したBase64データをJSONオブジェクトに変換する汎用ロジック
 * @param {string} base64Data - BLEから受信したBase64文字列
 * @returns {object | null} - 変換されたJSONオブジェクト
 */
const decodeAndParseData = (base64Data) => {
    try {
        if (!base64Data) return null;

        // 1. Base64をBufferにデコード
        const dataBuffer = Buffer.from(base64Data, 'base64');
        
        // 2. Bufferを文字列に変換 (JSON文字列を想定)
        const jsonString = dataBuffer.toString('utf8');

        // 3. JSONをパースしてオブジェクトを返す
        return JSON.parse(jsonString);

    } catch (e) {
        console.error('データ変換エラー:', e, '受信Base64:', base64Data);
        return null;
    }
};

/**
 * BLEスキャン、接続、データ購読を開始するメイン関数
 */
export const startBleProcess = async () => {
    // 権限チェックと初期化ロジックは省略（開発者が追加すべき）

    manager.startDeviceScan(null, null, async (error, device) => {
        if (error) {
            console.error('スキャンエラー:', error);
            return;
        }

        // 1. ESP32_MAX30205 を見つけたらスキャン停止
        if (device.name === DEVICE_NAME) {
            manager.stopDeviceScan();
            console.log(`デバイス ${DEVICE_NAME} を検出。接続中...`);

            try {
                // 2. 接続
                const connectedDevice = await device.connect();
                await connectedDevice.discoverAllServicesAndCharacteristics();
                console.log('接続成功。サービス発見完了。');

                // 3. Notify購読（データストリームの開始）
                connectedDevice.monitorCharacteristicForService(
                    SERVICE_UUID,
                    TEMP_CHARACTERISTIC_UUID,
                    (charError, characteristic) => {
                        if (charError) {
                            console.error('Notifyエラー:', charError);
                            return;
                        }

                        // 4. データ受信と処理
                        const receivedData = decodeAndParseData(characteristic.value);
                        
                        // 5. useWearableData.jsにデータを渡す
                        if (receivedData && dataCallback) {
                            dataCallback(receivedData);
                        }
                    }
                );
            } catch (connError) {
                console.error('接続または購読エラー:', connError);
                // 再スキャンまたは再接続ロジックをここに追加すべき
            }
        }
    });
};

// アプリ終了時の切断処理などもここに追加すべき