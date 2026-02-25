import { Feather } from '@expo/vector-icons';
import { Link, useNavigation } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// @ts-ignore
import { sendChatbotMessage } from '../../api/apiService';
import { useBLE } from '../../context/BLEContext';

type Message = {
  id: number;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
};

export default function HelpScreen() {
  const navigation = useNavigation();
  const [messageInput, setMessageInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // ✅ BLEの接続状態のみ取得（表示用）
  const { isConnected, connectedDevice } = useBLE();
  
  const scrollViewRef = useRef<ScrollView>(null); 
  const textInputRef = useRef<TextInput>(null);

  const [messages, setMessages] = useState<Message[]>([
    { 
      id: 1, 
      text: 'こんにちは！システムのヘルプデスクです。機能についてお気軽にお尋ねください。', 
      sender: 'assistant',
      timestamp: new Date()
    }
  ]);

  // ✅ メッセージが追加されたら自動スクロール
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // ✅ キーボード表示時の対応
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  const handleSendMessage = async () => {
    const textToSend = messageInput.trim();
    if (!textToSend) return;

    const userMsg: Message = {
      id: Date.now(),
      text: textToSend,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setMessageInput('');
    Keyboard.dismiss();
    setIsLoading(true);

    try {
      const data = await sendChatbotMessage(textToSend);

      const assistantMsg: Message = {
        id: Date.now() + 1,
        text: data.response || '回答を取得できませんでした。',
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMsg]);

    } catch (error) {
      console.error("通信エラー:", error);
      const errorMsg: Message = {
        id: Date.now() + 1,
        text: 'サーバーに接続できませんでした。しばらくしてからもう一度お試しください。',
        sender: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ メッセージをクリア
  const handleClearChat = () => {
    setMessages([
      { 
        id: 1, 
        text: 'こんにちは！システムのヘルプデスクです。機能についてお気軽にお尋ねください。', 
        sender: 'assistant',
        timestamp: new Date()
      }
    ]);
    setMessageInput('');
  };
  
  const MessageBubble = ({ message }: { message: Message }) => {
    const isUser = message.sender === 'user';
    return (
      <View style={[
        styles.messageRow,
        isUser ? styles.userMessageRow : styles.assistantMessageRow
      ]}>
        <View style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          isUser ? styles.userBorderRadius : styles.assistantBorderRadius
        ]}>
          <Text style={isUser ? styles.userText : styles.assistantText}>
            {message.text}
          </Text>
          <Text style={isUser ? styles.userTimestamp : styles.assistantTimestamp}>
            {message.timestamp.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  // ✅ ヘッダー
  const Header = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Link href="/(app)/user-home" asChild>
          <TouchableOpacity style={styles.backButton}>
            <Feather name="arrow-left" size={20} color="#333" />
          </TouchableOpacity>
        </Link>
        <Text style={styles.headerTitle}>ヘルプデスク</Text>
      </View>
      
      <View style={styles.headerRight}>
        <TouchableOpacity 
          style={styles.clearButton}
          onPress={handleClearChat}
        >
          <Feather name="refresh-cw" size={18} color="#666" />
        </TouchableOpacity>

        <View style={styles.connectionBadge}>
          <Feather 
            name="bluetooth" 
            size={12} 
            color={isConnected ? "#4a90e2" : "#999"} 
          />
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header />

      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView 
          ref={scrollViewRef}
          style={styles.chatContainer}
          contentContainerStyle={styles.chatContentContainer}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }}
        >
          {messages.length === 1 && (
            <View style={styles.welcomeContainer}>
              <Feather name="message-circle" size={50} color="#4a90e2" />
              <Text style={styles.welcomeTitle}>よくある質問</Text>
              <View style={styles.suggestionsContainer}>
                <TouchableOpacity 
                  style={styles.suggestionButton}
                  onPress={() => setMessageInput('グラフの見方を教えてください')}
                >
                  <Text style={styles.suggestionText}>📊 グラフの見方</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.suggestionButton}
                  onPress={() => setMessageInput('デバイスの接続方法は？')}
                >
                  <Text style={styles.suggestionText}>🔗 デバイス接続</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.suggestionButton}
                  onPress={() => setMessageInput('睡眠データの記録方法')}
                >
                  <Text style={styles.suggestionText}>😴 睡眠記録</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.suggestionButton}
                  onPress={() => setMessageInput('パスワードを忘れました')}
                >
                  <Text style={styles.suggestionText}>🔑 パスワード</Text>
                </TouchableOpacity>
              </View>

              {/* ✅ お問い合わせボタンを大きく表示 */}
              <Link href="/contact-form" asChild> 
                <TouchableOpacity style={styles.contactButtonLarge}>
                  <Feather name="mail" size={20} color="#fff" />
                  <Text style={styles.contactButtonLargeText}>お問い合わせフォーム</Text>
                </TouchableOpacity>
              </Link>
            </View>
          )}

          {messages.map(message => (
            <MessageBubble key={message.id} message={message} />
          ))}
          
          {isLoading && (
            <View style={[styles.messageRow, styles.assistantMessageRow]}>
              <View style={[styles.bubble, styles.assistantBubble, styles.assistantBorderRadius, styles.loadingBubble]}>
                <ActivityIndicator size="small" color="#4a90e2" />
                <Text style={styles.loadingText}>入力中...</Text>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.inputArea}>
          <View style={styles.inputWrapper}>
            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              placeholder="質問を入力してください..."
              placeholderTextColor="#999"
              value={messageInput}
              onChangeText={setMessageInput}
              editable={!isLoading}
              multiline
              maxLength={500}
              returnKeyType="default"
              blurOnSubmit={false}
            />
            <TouchableOpacity 
              style={[styles.sendButton, (!messageInput.trim() || isLoading) && styles.sendButtonDisabled]} 
              onPress={handleSendMessage}
              disabled={!messageInput.trim() || isLoading}
            >
              <Feather 
                name="send" 
                size={20} 
                color={(!messageInput.trim() || isLoading) ? "#999" : "white"} 
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FEF1E7', 
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FEF1E7',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  backButton: { 
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  connectionBadge: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  
  chatContainer: {
    flex: 1,
    backgroundColor: '#FEF1E7', 
  },
  chatContentContainer: {
    padding: 16,
    paddingBottom: 20,
  },

  // ✅ ウェルカムセクション
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 16,
  },
  suggestionsContainer: {
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  suggestionButton: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  suggestionText: {
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
  },
  // ✅ 大きなお問い合わせボタン
  contactButtonLarge: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#4a90e2',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    marginTop: 10,
  },
  contactButtonLargeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  
  messageRow: {
    marginBottom: 12,
    maxWidth: '85%',
  },
  assistantMessageRow: {
    alignSelf: 'flex-start',
  },
  userMessageRow: {
    alignSelf: 'flex-end',
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  assistantBubble: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  assistantBorderRadius: {
    borderBottomLeftRadius: 4,
  },
  assistantText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    marginBottom: 4,
  },
  assistantTimestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
  },
  userBubble: {
    backgroundColor: '#4a90e2',
  },
  userBorderRadius: {
    borderBottomRightRadius: 4,
  },
  userText: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 22,
    marginBottom: 4,
  },
  userTimestamp: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
    textAlign: 'right',
  },
  loadingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
  },
  inputArea: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 10 : 16, // ✅ Android用に下余白追加
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
});