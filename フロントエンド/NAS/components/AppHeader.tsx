import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface AppHeaderProps {
  title: string;
  showMenu?: boolean;
  showNotification?: boolean;
  showBack?: boolean;
  onMenuPress?: () => void;
  onNotificationPress?: () => void;
}

export default function AppHeader({ 
  title, 
  showMenu = true, 
  showNotification = true,
  showBack = false,
  onMenuPress,
  onNotificationPress
}: AppHeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      {/* 左側：ハンバーガーメニューまたは戻るボタン */}
      {showBack ? (
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.iconButton}
        >
          <Ionicons name="arrow-back" size={28} color="#333" />
        </TouchableOpacity>
      ) : showMenu ? (
        <TouchableOpacity 
          onPress={onMenuPress}
          style={styles.iconButton}
        >
          <Ionicons name="menu" size={28} color="#333" />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconPlaceholder} />
      )}

      {/* 中央：タイトル */}
      <Text style={styles.headerTitle}>{title}</Text>

      {/* 右側：通知アイコン */}
      {showNotification ? (
        <TouchableOpacity 
          onPress={onNotificationPress}
          style={styles.iconButton}
        >
          <Ionicons name="notifications-outline" size={24} color="#333" />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  iconButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconPlaceholder: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
});