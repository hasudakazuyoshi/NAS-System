import { Feather } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
import {
  addInquiryMessage,
  closeInquiry,
  createInquiry,
  getInquiries,
  getInquiryDetail
} from '../../api/apiService';

import { useFocusEffect } from '@react-navigation/native';
import { useBLE } from '../../context/BLEContext';

type Sender = 'user' | 'admin' | 'system';
type Status = 'pending' | 'resolved' | 'unhandled';

interface Message {
  sender: Sender;
  text: string;
  resolution?: boolean;
}

interface Thread {
  id: string;
  title: string;
  date: string;
  status: Status;
  messages: Message[];
}

interface Threads {
  [key: string]: Thread;
}

const CONTACT_CATEGORIES = [
  "パスワードについて", "グラフについて", "利用者情報について", "その他"
];

interface TopicModalProps {
  isVisible: boolean;
  onClose: () => void;
  onConfirm: (title: string) => void;
}

const TopicModal: React.FC<TopicModalProps> = ({ isVisible, onClose, onConfirm }) => {
  const [selectedCategory, setSelectedCategory] = useState(CONTACT_CATEGORIES[0]);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!isVisible) {
      setIsConfirming(false);
      setSelectedCategory(CONTACT_CATEGORIES[0]);
    }
  }, [isVisible]);

  const handleSelectConfirm = () => {
    if (selectedCategory) {
      setIsConfirming(true);
    }
  };

  const handleFinalConfirm = () => {
    onConfirm(selectedCategory);
    onClose();
  };

  const handleRevert = () => {
    setIsConfirming(false);
  };

  const SelectionContent = (
    <>
      <Text style={modalStyles.title}>お問い合わせ項目を選択</Text>
      <View style={modalStyles.categoryContainer}>
        {CONTACT_CATEGORIES.map(category => (
          <TouchableOpacity
            key={category}
            style={[
              modalStyles.categoryItem,
              selectedCategory === category && modalStyles.categoryItemSelected
            ]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text style={[
              modalStyles.categoryText,
              selectedCategory === category && modalStyles.categoryTextSelected
            ]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={modalStyles.buttons}>
        <TouchableOpacity
          style={[modalStyles.button, modalStyles.cancelBtn]}
          onPress={onClose}
        >
          <Text style={modalStyles.cancelText}>キャンセル</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[modalStyles.button, modalStyles.confirmBtn]}
          onPress={handleSelectConfirm}
          disabled={!selectedCategory}
        >
          <Text style={modalStyles.confirmText}>決定</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const ConfirmationContent = (
    <>
      <View style={modalStyles.confirmationArea}>
        <Text style={modalStyles.confirmationTitle}>
          {selectedCategory}
        </Text>
        <Text style={modalStyles.confirmationText}>
          決定すると変更できません。間違いはありませんか？
        </Text>
        <View style={[modalStyles.buttons, modalStyles.confirmationButtons]}>
          <TouchableOpacity
            style={[modalStyles.button, modalStyles.revertBtn]}
            onPress={handleRevert}
          >
            <Text style={modalStyles.revertText}>いいえ</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[modalStyles.button, modalStyles.finalConfirmBtn]}
            onPress={handleFinalConfirm}
          >
            <Text style={modalStyles.finalConfirmText}>はい</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <View style={modalStyles.content}>
          {isConfirming ? ConfirmationContent : SelectionContent}
        </View>
      </View>
    </Modal>
  );
};

interface MessageBubbleProps {
  message: Message;
  threadId: string;
  threads: Threads;
  handleResolve: (threadId: string, resolved: boolean) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, threadId, threads, handleResolve }) => {
  const isUser = message.sender === 'user';
  const isAdmin = message.sender === 'admin';
  const isSystem = message.sender === 'system';

  const showButtons = message.resolution && threads[threadId]?.status === 'pending';

  return (
    <View style={isSystem ? styles.systemMsgContainer : isUser ? styles.userMsgContainer : styles.adminMsgContainer}>
      <Text style={[
        styles.messageBubble,
        isSystem && styles.systemMsg,
        isAdmin && styles.adminMsg,
        isUser && styles.userMsg,
      ]}>
        {message.text}
      </Text>

      {showButtons && (
        <View style={styles.resolveButtons}>
          <Text style={styles.resolveQuestion}>解決しましたか？</Text>
          <View style={styles.resolveButtonRow}>
            <TouchableOpacity
              style={[styles.resolveBtn, styles.resolveBtnYes]}
              onPress={() => handleResolve(threadId, true)}
            >
              <Text style={styles.resolveBtnTextYes}>はい</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resolveBtn, styles.resolveBtnNo]}
              onPress={() => handleResolve(threadId, false)}
            >
              <Text style={styles.resolveBtnTextNo}>いいえ</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

export default function ContactFormScreen() {
  const navigation = useNavigation();
  const [threads, setThreads] = useState<Threads>({}); 
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // ✅ BLEの接続状態のみ取得（表示用）
  const { isConnected, connectedDevice } = useBLE();

  const chatScrollViewRef = useRef<ScrollView>(null);
  const textInputRef = useRef<TextInput>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ✅ キーボード表示時の対応
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          chatScrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // ✅ データ取得を関数化
  const fetchThreads = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getInquiries();

      console.log('📦 取得したお問い合わせ履歴:', JSON.stringify(data, null, 2));

      const inquiriesList = data.inquiries || data || [];
      
      if (Array.isArray(inquiriesList)) {
        const threadsObj: Threads = {};
        inquiriesList.forEach((item: any) => {
          let mappedStatus: Status = 'unhandled';
          if (item.status === '未対応') mappedStatus = 'unhandled';
          else if (item.status === '対応中') mappedStatus = 'pending';
          else if (item.status === '解決済み') mappedStatus = 'resolved';

          const mappedMessages: Message[] = item.latest_message ? [
            { sender: 'user', text: item.latest_message, resolution: false }
          ] : [];

          threadsObj[item.inquiryID] = {
            id: item.inquiryID,
            title: item.inquiryname || '無題',
            date: item.time || new Date().toISOString(),
            status: mappedStatus,
            messages: mappedMessages
          };
        });
        
        console.log('✅ 変換後のthreadsObj:', Object.keys(threadsObj).length, '件');
        setThreads(threadsObj);
      } else {
        console.log('⚠️ データが配列ではありません');
        setThreads({});
      }

    } catch (error) {
      console.error("❌ 履歴の読み込みエラー:", error);
      setThreads({});
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ✅ 画面フォーカス時に自動更新
  useFocusEffect(
    useCallback(() => {
      console.log('📱 画面フォーカス - データ取得');
      fetchThreads();
    }, [fetchThreads])
  );

  useEffect(() => {
    if (chatScrollViewRef.current && activeThreadId) {
      setTimeout(() => {
        chatScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [threads[activeThreadId as string]?.messages.length, activeThreadId]);

  const loadThread = async (threadId: string) => {
    setActiveThreadId(threadId);
    setMessageInput('');

    try {
      console.log('📥 スレッド詳細取得中:', threadId);
      const detailData = await getInquiryDetail(threadId);

      console.log('📦 取得した詳細:', JSON.stringify(detailData, null, 2));

      if (detailData.success && detailData.detail) {
        const detail = detailData.detail;

        const messages: Message[] = [];
        if (detail.thread_history && Array.isArray(detail.thread_history)) {
          detail.thread_history.forEach((item: any) => {
            let sender: Sender = 'user';
            if (item.sender === 'admin') sender = 'admin';
            else if (item.sender === 'system') sender = 'system';

            messages.push({
              sender: sender,
              text: item.message,
              resolution: false
            });
          });

          if (messages.length > 0 && 
              messages[messages.length - 1].sender === 'admin' && 
              detail.status === '対応中') {
            messages[messages.length - 1].resolution = true;
          }
        }

        let mappedStatus: Status = 'unhandled';
        if (detail.status === '未対応') mappedStatus = 'unhandled';
        else if (detail.status === '対応中') mappedStatus = 'pending';
        else if (detail.status === '解決済み') mappedStatus = 'resolved';

        const newThreads = { ...threads };
        if (newThreads[threadId]) {
          newThreads[threadId] = {
            ...newThreads[threadId],
            status: mappedStatus,
            messages: messages
          };
          setThreads(newThreads);
        }
      }
    } catch (error) {
      console.error('❌ スレッド詳細取得エラー:', error);
      Alert.alert('エラー', 'メッセージの読み込みに失敗しました');
    }
  };

  const handleResolve = async (threadId: string, resolved: boolean) => {
    const thread = threads[threadId];
    if (!thread) return;

    let systemMessageText = '';
    const newStatus: Status = resolved ? 'resolved' : 'unhandled';

    if (resolved) {
      systemMessageText = '「はい」が選択されました。このお問い合わせは「回答済み」になりました。';
    } else {
      systemMessageText = '「いいえ」が選択されました。引き続きご質問ください。';
    }

    const newThreads = { ...threads };
    newThreads[threadId] = {
      ...thread,
      status: newStatus,
      messages: [
        ...thread.messages.slice(0, -1),
        { sender: 'system', text: systemMessageText },
      ],
    };
    setThreads(newThreads);

    try {
      if (resolved) {
        await closeInquiry(threadId);
      }
    } catch (error) {
      console.error("ステータス更新エラー:", error);
    }
  };

  const isSendDisabled = () => {
    const thread = threads[activeThreadId as string];
    if (!activeThreadId || !thread) return true;
    if (thread.status === 'pending') return true;
    return messageInput.trim() === '';
  };

  const handleSendMessage = async () => {
    const text = messageInput.trim();
    const threadId = activeThreadId as string;
    const thread = threads[threadId];

    if (isSendDisabled() || text === '') return;

    try {
      await addInquiryMessage(threadId, text);

      const newThreads = { ...threads };
      newThreads[threadId] = {
        ...thread,
        status: 'unhandled',
        messages: [...thread.messages, { sender: 'user', text: text }],
      };
      setThreads(newThreads);
      setMessageInput('');

      // ✅ メッセージ送信後にスクロール
      setTimeout(() => {
        chatScrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error("❌ メッセージ送信エラー:", error);
      Alert.alert("エラー", "送信に失敗しました");
    }
  };

  const handleNewContactConfirm = async (newTitle: string) => {
    try {
      const responseData = await createInquiry({
        inquiry_name: newTitle,
        initial_message: "お問い合わせを開始します"
      });

      console.log('📦 作成されたお問い合わせ:', responseData);

      if (responseData.success) {
        Alert.alert("新規お問い合わせ", `「${newTitle}」の新規お問い合わせが開始されました。`);

        await fetchThreads();

        if (responseData.inquiry_id) {
          setActiveThreadId(responseData.inquiry_id);
        }

        setMessageInput('');
      }

    } catch (error) {
      console.error("❌ 作成エラー:", error);
      Alert.alert("エラー", "作成に失敗しました");
    }
  };

  const sortedThreadKeys = Object.keys(threads || {}).sort((a, b) => {
    const dateA = threads[a]?.date || '';
    const dateB = threads[b]?.date || '';
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });

  const activeThread = activeThreadId ? threads[activeThreadId] : null;

  // ✅ ヘッダーバー（更新ボタン付き）
  const HeaderBar = () => (
    <View style={styles.topBar}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Feather name="arrow-left" size={20} color="#333" />
      </TouchableOpacity>
      
      <Text style={styles.headerTitle}>お問い合わせ</Text>
      
      <View style={styles.headerRight}>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={fetchThreads}
          disabled={isLoading}
        >
          <Feather 
            name="refresh-cw" 
            size={18} 
            color={isLoading ? "#ccc" : "#4a90e2"} 
          />
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
      <TopicModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onConfirm={handleNewContactConfirm}
      />

      <HeaderBar />

      <KeyboardAvoidingView 
        style={styles.contentWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <TouchableOpacity
          style={styles.newContactBtn}
          onPress={() => setIsModalVisible(true)}
        >
          <Feather name="plus-circle" size={18} color="#4a90e2" />
          <Text style={styles.newContactText}>新規お問い合わせ</Text>
        </TouchableOpacity>

        <View style={styles.container}>
          {isLoading && Object.keys(threads).length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4a90e2" />
              <Text style={styles.loadingText}>読み込み中...</Text>
            </View>
          ) : (
            <ScrollView style={styles.historyList} showsVerticalScrollIndicator={false}>
              {sortedThreadKeys.length === 0 ? (
                <View style={styles.emptyHistory}>
                  <Feather name="inbox" size={40} color="#ccc" />
                  <Text style={styles.emptyHistoryText}>お問い合わせ履歴がありません</Text>
                </View>
              ) : (
                sortedThreadKeys.map(key => (
                  <HistoryItemComponent 
                    key={key} 
                    thread={threads[key]} 
                    loadThread={loadThread} 
                    activeThreadId={activeThreadId} 
                  />
                ))
              )}
            </ScrollView>
          )}

          <ScrollView
            ref={chatScrollViewRef}
            style={styles.chatArea}
            contentContainerStyle={styles.chatAreaContent}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              chatScrollViewRef.current?.scrollToEnd({ animated: true });
            }}
          >
            {activeThread ? (
              activeThread.messages.length === 0 ? (
                <View style={styles.emptyChatContainer}>
                  <Feather name="message-circle" size={50} color="#ccc" />
                  <Text style={styles.emptyChatText}>メッセージを送信してください</Text>
                </View>
              ) : (
                activeThread.messages.map((msg, index) => (
                  <MessageBubble
                    key={index}
                    message={msg}
                    threadId={activeThread.id}
                    threads={threads}
                    handleResolve={handleResolve}
                  />
                ))
              )
            ) : (
              <View style={styles.emptyChatContainer}>
                <Feather name="message-square" size={50} color="#ccc" />
                <Text style={styles.initialMsg}>履歴を選択するか{'\n'}新規お問い合わせを作成してください</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputArea}>
            <View style={styles.inputWrapper}>
              <TextInput
                ref={textInputRef}
                style={styles.inputBox}
                placeholder="メッセージを入力..."
                placeholderTextColor="#999"
                value={messageInput}
                onChangeText={setMessageInput}
                editable={!!activeThread && activeThread.status !== 'pending'}
                multiline
                maxLength={500}
                returnKeyType="default"
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[styles.sendBtn, isSendDisabled() && styles.sendBtnDisabled]}
                onPress={handleSendMessage}
                disabled={isSendDisabled()}
              >
                <Feather 
                  name="send" 
                  size={20} 
                  color={isSendDisabled() ? "#999" : "white"} 
                />
              </TouchableOpacity>
            </View>
            {activeThread && activeThread.status === 'pending' && (
              <Text style={styles.waitingMessage}>
                管理者からの返信をお待ちください
              </Text>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface HistoryItemProps {
  thread: Thread;
  loadThread: (id: string) => void;
  activeThreadId: string | null;
}

const HistoryItemComponent: React.FC<HistoryItemProps> = ({ thread, loadThread, activeThreadId }) => {
  const isSelected = thread.id === activeThreadId;
  const statusClass = thread.status === 'pending'
    ? styles.statusPending
    : thread.status === 'resolved'
      ? styles.statusResolved
      : styles.statusUnhandled;
  const statusText = thread.status === 'pending' ? '回答待ち' : thread.status === 'resolved' ? '回答済み' : '未対応';

  return (
    <TouchableOpacity
      style={[styles.historyItem, isSelected && styles.historyItemActive]}
      onPress={() => loadThread(thread.id)}
      activeOpacity={0.7}
    >
      <View style={styles.historyItemContent}>
        <Text style={styles.historyTitle} numberOfLines={1}>{thread.title}</Text>
        <Text style={styles.historyDate}>{new Date(thread.date).toLocaleDateString('ja-JP')}</Text>
      </View>
      <View style={[styles.statusBadge, statusClass]}>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FEF1E7' },
  contentWrapper: { 
    flex: 1, 
    width: '100%', 
    paddingHorizontal: 16, 
    paddingBottom: Platform.OS === 'ios' ? 0 : 10,
  },
  topBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    width: '100%', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    backgroundColor: '#FEF1E7',
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
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  refreshButton: {
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
  newContactBtn: { 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%', 
    padding: 14, 
    marginBottom: 16,
    backgroundColor: '#fff', 
    borderWidth: 1, 
    borderColor: '#4a90e2', 
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  newContactText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#4a90e2',
  },
  container: { 
    width: '100%', 
    flex: 1, 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    overflow: 'hidden', 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 }, 
    shadowOpacity: 0.1, 
    shadowRadius: 8, 
    elevation: 5,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#777',
    fontSize: 14,
  },
  historyList: { 
    maxHeight: 180,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  emptyHistory: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  historyItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    backgroundColor: 'white', 
    padding: 14,
    marginHorizontal: 10,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  historyItemActive: { 
    borderColor: '#4a90e2',
    backgroundColor: '#f0f7ff',
    borderWidth: 2,
  },
  historyItemContent: {
    flex: 1,
    marginRight: 10,
  },
  historyTitle: { 
    fontSize: 15, 
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  historyDate: { 
    fontSize: 12, 
    color: '#999',
  },
  statusBadge: { 
    paddingVertical: 4, 
    paddingHorizontal: 10, 
    borderRadius: 12,
  },
  statusText: { 
    color: 'white', 
    fontSize: 11, 
    fontWeight: '600',
  },
  statusPending: { backgroundColor: '#dc3545' },
  statusResolved: { backgroundColor: '#28a745' },
  statusUnhandled: { backgroundColor: '#ffc107' },
  chatArea: { 
    flex: 1,
  },
  chatAreaContent: { 
    padding: 16,
    gap: 12,
  },
  emptyChatContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyChatText: {
    marginTop: 16,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  initialMsg: { 
    marginTop: 16,
    fontSize: 14, 
    color: '#999',
    textAlign: 'center',
    lineHeight: 22,
  },
  messageBubble: { 
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    borderRadius: 16, 
    maxWidth: '100%', 
    lineHeight: 20,
    fontSize: 15,
  },
  adminMsgContainer: { 
    alignSelf: 'flex-start', 
    maxWidth: '85%',
  },
  userMsgContainer: { 
    alignSelf: 'flex-end', 
    maxWidth: '85%',
  },
  systemMsgContainer: { 
    alignSelf: 'center', 
    width: '100%',
    paddingVertical: 8,
  },
  adminMsg: { 
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
    color: '#333',
  },
  userMsg: { 
    backgroundColor: '#4a90e2', 
    color: 'white',
    borderBottomRightRadius: 4,
  },
  systemMsg: { 
    textAlign: 'center', 
    fontSize: 13, 
    color: '#777',
    backgroundColor: 'transparent',
    fontStyle: 'italic',
  },
  resolveButtons: { 
    marginTop: 12,
    gap: 8,
  },
  resolveQuestion: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  resolveButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resolveBtn: { 
    paddingVertical: 8, 
    paddingHorizontal: 20, 
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    alignItems: 'center',
  },
  resolveBtnYes: { 
    backgroundColor: '#28a745',
    borderColor: '#28a745',
  },
  resolveBtnNo: { 
    backgroundColor: '#6c757d',
    borderColor: '#6c757d',
  },
  resolveBtnTextYes: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  resolveBtnTextNo: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  inputArea: { 
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1, 
    borderTopColor: '#e0e0e0', 
    backgroundColor: '#f8f9fa',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  inputBox: { 
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    fontSize: 15, 
    borderWidth: 1, 
    borderColor: '#e0e0e0', 
    borderRadius: 20,
    backgroundColor: 'white',
    textAlignVertical: 'top',
  },
  sendBtn: { 
    backgroundColor: '#4a90e2', 
    borderRadius: 24, 
    width: 48, 
    height: 48, 
    justifyContent: 'center', 
    alignItems: 'center',
    shadowColor: '#4a90e2',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendBtnDisabled: { 
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  waitingMessage: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

const modalStyles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center',
    padding: 20,
  },
  content: { 
    backgroundColor: 'white', 
    padding: 24, 
    borderRadius: 12, 
    width: '100%', 
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  title: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 20, 
    textAlign: 'center',
    color: '#333',
  },
  categoryContainer: { 
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  categoryItem: { 
    padding: 16, 
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryItemSelected: { 
    backgroundColor: '#e8f0ff',
  },
  categoryText: { 
    fontSize: 15,
    color: '#333',
  },
  categoryTextSelected: {
    fontWeight: '600',
    color: '#4a90e2',
  },
  buttons: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: 12,
  },
  button: { 
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    borderRadius: 8,
    minWidth: 80, 
    alignItems: 'center',
  },
  cancelBtn: { 
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  confirmBtn: { 
    backgroundColor: '#4a90e2',
  },
  cancelText: { 
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  confirmText: { 
    color: 'white', 
    fontSize: 15,
    fontWeight: '600',
  },
  confirmationArea: { 
    alignItems: 'center', 
    paddingVertical: 20,
  },
  confirmationTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 16, 
    padding: 12, 
    backgroundColor: '#f0f7ff', 
    borderRadius: 8,
    color: '#4a90e2',
  },
  confirmationText: { 
    fontSize: 15, 
    textAlign: 'center', 
    marginBottom: 30, 
    lineHeight: 22,
    color: '#555',
  },
  confirmationButtons: { 
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  revertBtn: { 
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minWidth: 120,
  },
  revertText: { 
    fontSize: 15, 
    color: '#333',
    fontWeight: '500',
  },
  finalConfirmBtn: { 
    backgroundColor: '#4a90e2',
    minWidth: 120,
  },
  finalConfirmText: { 
    color: 'white', 
    fontSize: 15,
    fontWeight: '600',
  },
});