import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      
      {/* タイトル */}
      <Text style={styles.title}>メニュー / 設定</Text>
      
      {/* 区切り線 */}
      <View style={styles.separator} />

      {/* 説明文 */}
      <Text style={styles.description}>
        ここはモーダル画面です。{'\n'}
        アプリの設定や、詳細情報をここに表示できます。
      </Text>

      {/* 閉じるボタン */}
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => router.back()}
      >
        <Text style={styles.buttonText}>閉じる</Text>
      </TouchableOpacity>

      {/* iOSのモーダル表示用のステータスバー設定 */}
      <StatusBar style={Platform.OS === 'ios' ? 'light' : 'auto'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // アプリ共通の背景色
    backgroundColor: '#FEF1E7', 
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  separator: {
    marginVertical: 20,
    height: 1,
    width: '80%',
    backgroundColor: '#ccc',
  },
  description: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#4a90e2',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});