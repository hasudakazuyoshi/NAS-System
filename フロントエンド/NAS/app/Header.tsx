import React, { useState } from 'react';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
// useNavigationはReact Navigationからインポートされます
import { useNavigation } from '@react-navigation/native';

// React Navigationの型が未定義の場合、anyで代用します
const Header = () => {
    // useNavigationフックを呼び出す
    const navigation = useNavigation<any>();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(prev => !prev);
    };

    const handleLogout = () => {
        Alert.alert(
            "ログアウト",
            "ログアウトしてもよろしいですか？",
            [
                { text: "キャンセル", style: "cancel" },
                {
                    text: "OK",
                    onPress: () => {
                        console.log("ログアウト処理を実行");
                        // 実際のログアウト後の画面遷移処理をここに記述 (例: navigation.reset)
                    }
                }
            ]
        );
    };

    // 画面遷移を実行する関数
    const handleMenuNavigation = (screenName: string) => {
        console.log(`${screenName} へ移動`);
        
        let targetScreen: string;
        // ナビゲーションの画面名とメニューボタンの表示名をマッピング
        if (screenName === '利用者情報') {
            targetScreen = 'user-info'; 
        } else if (screenName === 'グラフ') {
            // ⭐ ここを修正しました！切り替えボタンを持つメイン画面に遷移させます。
            targetScreen = 'explore'; 
        } else if (screenName === 'ヘルプ') {
            targetScreen = 'help'; 
        } else {
            return;
        }

        // 画面遷移を実行
        navigation.navigate(targetScreen);
        
        // メニューを閉じる
        setIsMenuOpen(false);
    };

    const menuIconLine1Style = [
        styles.menuIconLine,
        isMenuOpen ? styles.menuIconLine1Active : null
    ];
    const menuIconLine2Style = [
        styles.menuIconLine,
        isMenuOpen ? styles.menuIconLine2Active : null
    ];
    const menuIconLine3Style = [
        styles.menuIconLine,
        isMenuOpen ? styles.menuIconLine3Active : null
    ];

    return (
        <SafeAreaView style={styles.headerSafeArea}>
            <View style={styles.headerContainer}>
                
                <TouchableOpacity style={styles.menuIcon} onPress={toggleMenu}>
                    <View style={menuIconLine1Style} />
                    <View style={menuIconLine2Style} />
                    <View style={menuIconLine3Style} />
                </TouchableOpacity>

                <View style={styles.titleContainer}>
                    <Text style={styles.title}>NASシステム</Text>
                </View>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutButtonText}>ログアウト</Text>
                </TouchableOpacity>
            </View>

            {isMenuOpen && (
                <View style={styles.sideMenu}>
                    <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuNavigation('利用者情報')}>
                        <Text style={styles.menuItemText}>利用者情報</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuNavigation('グラフ')}>
                        <Text style={styles.menuItemText}>グラフ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuNavigation('ヘルプ')}>
                        <Text style={styles.menuItemText}>ヘルプ</Text>
                    </TouchableOpacity>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    headerSafeArea: {
        backgroundColor: '#8BC34A',
        zIndex: 20,
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 5,
      },
      headerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 15,
        height: 60,
      },
      menuIcon: {
        width: 30,
        height: 22,
        justifyContent: 'space-between',
        paddingVertical: 1.5,
      },
      menuIconLine: {
        width: '100%',
        height: 3,
        backgroundColor: 'white',
        borderRadius: 3,
      },
      menuIconLine1Active: {
        position: 'absolute',
        top: 9.5,
        transform: [{ rotate: '45deg' }],
      },
      menuIconLine2Active: {
        opacity: 0,
      },
      menuIconLine3Active: {
        position: 'absolute',
        top: 9.5,
        transform: [{ rotate: '-45deg' }],
      },
      titleContainer: {
        flex: 1,
        alignItems: 'center',
      },
      title: {
        color: 'white',
        fontSize: 22,
        fontWeight: 'bold',
      },
      logoutButton: {
        backgroundColor: 'white',
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 6,
      },
      logoutButtonText: {
        color: '#8BC34A',
        fontSize: 14,
        fontWeight: 'bold',
      },
      sideMenu: {
        position: 'absolute',
        top: 60,
        left: 0,
        width: 230,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#e0e0e0',
        shadowColor: "#000",
        shadowOffset: {
          width: 2,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 10,
        zIndex: 10,
      },
      menuItem: {
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
      },
      menuItemText: {
        color: '#333',
        fontSize: 16,
      },
});

export default Header;