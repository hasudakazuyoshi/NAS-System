#include <NimBLEDevice.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <MAX30105.h>
#include <heartRate.h> 
#include <time.h>

// --- UUID設定 ---
#define SERVICE_UUID         "abcd1234-ef56-7890-abcd-1234567890ab"
#define CHARACTERISTIC_UUID "12345678-1234-1234-1234-1234567890ab"

// ✅ データ分割設定
#define MAX_CHUNK_DATA_SIZE 15  // ヘッダー "n/total:" を考慮した実データサイズ

Adafruit_MPU6050 mpu;
MAX30105 particleSensor;
NimBLECharacteristic* pCharacteristic = nullptr;

int connectedCount = 0;   
bool deviceConnected = false; 
unsigned long lastRecordTime = 0;

bool isSynced = false; 

float tempOffset = 3.0; 
const uint32_t ONE_MINUTE = 60000; 

const byte AVG_SIZE = 4; 
byte bpmBuffer[AVG_SIZE];
byte bpmIndex = 0;
long lastBeat = 0;
int stableBPM = 0;
float lastTotalAcc = 0;
float maxMotionInMinute = 0.0; 

// ✅ I2Cスキャン関数（デバッグ用）
void scanI2C() {
    Serial.println("🔍 I2Cデバイススキャン開始...");
    byte error, address;
    int nDevices = 0;

    for(address = 1; address < 127; address++) {
        Wire.beginTransmission(address);
        error = Wire.endTransmission();

        if (error == 0) {
            Serial.printf("✅ I2Cデバイス発見: 0x%02X\n", address);
            nDevices++;
        } else if (error == 4) {
            Serial.printf("❌ アドレス 0x%02X でエラー発生\n", address);
        }
    }
    
    if (nDevices == 0) {
        Serial.println("❌ I2Cデバイスが1つも見つかりません");
        Serial.println("   → 配線を確認してください");
        Serial.println("   → SDA=GPIO21, SCL=GPIO22");
    } else {
        Serial.printf("✅ %d個のI2Cデバイスを検出\n", nDevices);
    }
    Serial.println("==========================================");
}

// ✅ データ分割送信関数（完全修正版）
void sendDataInChunks(const char* data) {
    int dataLen = strlen(data);
    int totalChunks = (dataLen + MAX_CHUNK_DATA_SIZE - 1) / MAX_CHUNK_DATA_SIZE;
    
    Serial.println("==========================================");
    Serial.printf("📦 データ分割送信開始\n");
    Serial.printf("   元データ: %s\n", data);
    Serial.printf("   全体サイズ: %d バイト\n", dataLen);
    Serial.printf("   分割数: %d チャンク\n", totalChunks);
    
    // ✅ 元データのHEXダンプ（デバッグ用）
    Serial.print("   HEX: ");
    for(int i = 0; i < dataLen; i++) {
        Serial.printf("%02X ", (unsigned char)data[i]);
    }
    Serial.println();
    Serial.println("==========================================");
    
    // 各チャンクを送信
    for (int i = 0; i < totalChunks; i++) {
        int start = i * MAX_CHUNK_DATA_SIZE;
        int end = min(start + MAX_CHUNK_DATA_SIZE, dataLen);
        int chunkLen = end - start;
        
        // ✅ バッファを毎回完全にゼロクリア
        char chunk[MAX_CHUNK_DATA_SIZE + 1];
        memset(chunk, 0, sizeof(chunk));
        
        // チャンクを切り出し
        memcpy(chunk, data + start, chunkLen);
        chunk[chunkLen] = '\0';
        
        // ✅ ヘッダー付きパケット作成: "n/total:data"
        char packet[50];  // 十分な余裕を持たせる
        memset(packet, 0, sizeof(packet));
        snprintf(packet, sizeof(packet), "%d/%d:%s", i + 1, totalChunks, chunk);
        
        Serial.printf("📤 チャンク[%d/%d]送信\n", i + 1, totalChunks);
        Serial.printf("   内容: %s\n", packet);
        Serial.printf("   長さ: %d バイト\n", strlen(packet));
        Serial.print("   HEX: ");
        for(int j = 0; j < strlen(packet); j++) {
            Serial.printf("%02X ", (unsigned char)packet[j]);
        }
        Serial.println();
        
        // BLE送信
        pCharacteristic->setValue(packet);
        pCharacteristic->notify();
        
        delay(50); // パケット間隔
    }
    
    // ✅ 終了マーカー送信
    delay(100);
    Serial.println("📤 終了マーカー送信: END");
    pCharacteristic->setValue("END");
    pCharacteristic->notify();
    
    Serial.println("✅ 全チャンク送信完了");
    Serial.println("==========================================");
}

void syncTime(String timestamp) {
    if (timestamp.startsWith("T")) {
        timestamp.trim();
        long long epoch = atoll(timestamp.substring(1).c_str());
        time_t t = (time_t)epoch;
        struct timeval tv = { .tv_sec = t };
        settimeofday(&tv, NULL);
        setenv("TZ", "JST-9", 1);
        tzset();
        
        // ✅ 同期完了を詳細ログ
        time_t now = time(NULL);
        struct tm *tm_info = localtime(&now);
        char syncedTime[25];
        strftime(syncedTime, sizeof(syncedTime), "%Y/%m/%d %H:%M:%S", tm_info);
        
        Serial.println("\n==========================================");
        Serial.println("✅ 時刻同期成功!");
        Serial.printf("   同期時刻: %s\n", syncedTime);
        Serial.println("   1分後にデータ送信を開始します...");
        Serial.println("==========================================");

        if (pCharacteristic) {
            pCharacteristic->setValue("SYNC_OK");
            pCharacteristic->notify();
        }
        
        maxMotionInMinute = 0.0;
        lastRecordTime = millis(); 
        isSynced = true;          
    }
}

class MyCallbacks : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pChar, NimBLEConnInfo& connInfo) override {
        String received = String(pChar->getValue().c_str());
        Serial.printf("📥 受信データ: %s\n", received.c_str());
        syncTime(received);
    }
};

class ServerCallbacks : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
        connectedCount++;
        deviceConnected = true;
        Serial.println("==========================================");
        Serial.println("📱 デバイス接続");
        Serial.printf("   接続数: %d\n", connectedCount);
        Serial.println("==========================================");
        
        pServer->updateConnParams(connInfo.getConnHandle(), 24, 48, 0, 60);
        if (connectedCount < 3) {
            delay(200); 
            NimBLEDevice::startAdvertising();
        }
    }
    
    void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo, int reason) override {
        connectedCount--;
        Serial.println("==========================================");
        Serial.println("📱 デバイス切断");
        Serial.printf("   切断理由: %d\n", reason);
        Serial.printf("   残り接続数: %d\n", connectedCount);
        Serial.println("==========================================");
        
        if (connectedCount <= 0) {
            connectedCount = 0;
            deviceConnected = false;
        }
        NimBLEDevice::startAdvertising();
    }
};

void setup() {
    Serial.begin(115200);
    delay(1000); 
    
    Serial.println("\n\n");
    Serial.println("==========================================");
    Serial.println("🚀 ESP32 健康モニタリングシステム起動");
    Serial.println("   バージョン: 1.2 (動き検出修正版)");
    Serial.println("==========================================");
    
    // ✅ I2C初期化（明示的に設定）
    Serial.println("🔧 I2Cバス初期化中...");
    Wire.begin(21, 22);  // SDA=GPIO21, SCL=GPIO22
    Wire.setClock(100000);  // 100kHzに設定（安定性優先）
    delay(100);
    
    // ✅ I2Cスキャン実行
    scanI2C();
    
    // ✅ MPU6050初期化
    Serial.println("🔧 MPU6050初期化中...");
    if (!mpu.begin()) {
        Serial.println("❌ MPU6050が見つかりません");
        Serial.println("   → アドレス: 0x68 または 0x69");
        Serial.println("   → 配線を確認してください");
    } else {
        Serial.println("✅ MPU6050初期化成功");
        mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
        mpu.setGyroRange(MPU6050_RANGE_500_DEG);
        mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    }
    
    // ✅ MAX30105初期化
    Serial.println("🔧 MAX30105初期化中...");
    if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
        Serial.println("❌ MAX30105が見つかりません");
        Serial.println("   → アドレス: 0x57");
        Serial.println("   → 配線を確認してください");
    } else {
        Serial.println("✅ MAX30105初期化成功");
        particleSensor.setup(); 
        particleSensor.setPulseAmplitudeRed(0x0A);
        particleSensor.setPulseAmplitudeGreen(0);
    }
    
    Serial.println("==========================================");

    // ✅ Bluetooth初期化
    Serial.println("🔧 Bluetooth初期化中...");
    NimBLEDevice::init("ESP32"); 
    NimBLEDevice::setMTU(256);
    NimBLEDevice::setPower(ESP_PWR_LVL_P9); 

    NimBLEServer* pServer = NimBLEDevice::createServer();
    pServer->setCallbacks(new ServerCallbacks());
    
    NimBLEService* pService = pServer->createService(SERVICE_UUID);
    pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID, 
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::NOTIFY
    );
    pCharacteristic->setCallbacks(new MyCallbacks());
    pService->start();
    
    NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
    NimBLEAdvertisementData advData;
    advData.setFlags(BLE_HS_ADV_F_DISC_GEN | BLE_HS_ADV_F_BREDR_UNSUP);
    advData.setName("ESP32");
    advData.setCompleteServices(NimBLEUUID(SERVICE_UUID));
    pAdvertising->setAdvertisementData(advData);
    pAdvertising->enableScanResponse(true); 
    pAdvertising->start();

    Serial.println("✅ 起動完了");
    Serial.println("   → Bluetoothスキャンを開始してください");
    Serial.println("   → デバイス名: ESP32");
    Serial.println("==========================================\n");
}

void loop() {
    // ✅ 加速度センサ処理（修正版 - 異常値フィルタリング＆スケーリング）
    sensors_event_t a, g, temp_mpu;
    if (mpu.getEvent(&a, &g, &temp_mpu)) {
        float totalAcc = sqrt(a.acceleration.x * a.acceleration.x + 
                             a.acceleration.y * a.acceleration.y + 
                             a.acceleration.z * a.acceleration.z);
        
        if (lastTotalAcc > 0) {
            float diff = abs(totalAcc - lastTotalAcc);
            
            // ✅ 異常値フィルタリング（100以上は明らかなノイズ）
            if (diff < 100.0) {
                // ✅ 0-20のスケールに正規化（10で割る）
                float scaledDiff = diff / 10.0;
                
                // ✅ 上限を20に制限
                if (scaledDiff > 20.0) {
                    scaledDiff = 20.0;
                }
                
                if (scaledDiff > maxMotionInMinute) {
                    maxMotionInMinute = scaledDiff;
                }
            } else {
                Serial.printf("⚠️ 異常な加速度差分を検出: %.2f (無視)\n", diff);
            }
        }
        lastTotalAcc = totalAcc;
    }

    // ✅ 心拍センサ処理
    long irValue = particleSensor.getIR();
    if (irValue < 50000) { 
        stableBPM = 0; 
        for(int i = 0; i < AVG_SIZE; i++) {
            bpmBuffer[i] = 0;
        }
    } 
    else if (checkForBeat(irValue)) {
        long delta = millis() - lastBeat;
        lastBeat = millis();
        float bpm = 60 / (delta / 1000.0);
        
        if (bpm > 45 && bpm < 160) { 
            bpmBuffer[bpmIndex++] = (byte)bpm;
            bpmIndex %= AVG_SIZE;
            
            int sum = 0;
            for(int i = 0; i < AVG_SIZE; i++) {
                sum += bpmBuffer[i];
            }
            stableBPM = sum / AVG_SIZE; 
        }
    }

    // ✅ 1分ごとにデータを記録＆分割送信
    if (isSynced && millis() - lastRecordTime >= ONE_MINUTE) {
        lastRecordTime = millis();

        // ✅ 現在時刻取得
        time_t now = time(NULL);
        struct tm *tm_info = localtime(&now);
        char dtStr[25];
        strftime(dtStr, sizeof(dtStr), "%Y/%m/%d %H:%M:%S", tm_info);

        // ✅ 体温取得
        float bodyTemp = particleSensor.readTemperature() + tempOffset;

        // ✅ カンマ区切り形式でデータ生成
        char dataToSend[100];
        memset(dataToSend, 0, sizeof(dataToSend));  // ゼロクリア
        snprintf(dataToSend, sizeof(dataToSend), "%s,%d,%.1f,%.2f",
                 dtStr, 
                 stableBPM, 
                 bodyTemp, 
                 maxMotionInMinute);

        Serial.println("\n==========================================");
        Serial.println("📝 1分間隔データ記録");
        Serial.printf("   時刻: %s\n", dtStr);
        Serial.printf("   心拍数: %d bpm\n", stableBPM);
        Serial.printf("   体温: %.1f°C\n", bodyTemp);
        Serial.printf("   動き: %.2f\n", maxMotionInMinute);
        Serial.println("------------------------------------------");
        Serial.printf("生成データ: %s\n", dataToSend);
        Serial.printf("データ長: %d バイト\n", strlen(dataToSend));
        Serial.println("==========================================");

        if (deviceConnected) {
            // ✅ 分割送信
            sendDataInChunks(dataToSend);
        } else {
            Serial.println("⚠️ デバイス未接続のため送信スキップ");
        }

        // ✅ 動き検知リセット
        maxMotionInMinute = 0.0;
    }
    
    delay(20);
}
