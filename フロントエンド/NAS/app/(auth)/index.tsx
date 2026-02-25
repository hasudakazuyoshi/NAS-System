// app/(auth)/login.tsx
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// @ts-ignore
import { login } from '../../api/apiService';
import { useAuth } from '../../context/AuthContext';

// =====================
// マスコットコンポーネント
// =====================
const MascotCharacter: React.FC<{ size?: number }> = ({ size = 130 }) => {
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // ふわふわ上下
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 呼吸スケール
    Animated.loop(
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 軽いゆらぎ
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: -1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const rotate = rotateAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-3deg', '3deg'],
  });

  return (
    <Animated.Image
      source={require('../../assets/images/mascot.png')}
      style={{
        width: size,
        height: size,
        resizeMode: 'contain',
        transform: [
          { translateY: floatAnim },
          { scale: scaleAnim },
          { rotate },
        ],
      }}
    />
  );
};

// =====================
// ログイン画面
// =====================
const LoginScreen: React.FC = () => {
  const router = useRouter();
  const { login: authLogin } = useAuth();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  // 画面フェードイン
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async (): Promise<void> => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('入力エラー', 'メールアドレスとパスワードを入力してください。');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('入力エラー', '有効なメールアドレスを入力してください。');
      return;
    }

    setLoading(true);
    try {
      const data = await login(email.trim(), password);

      if (data.tokens && data.tokens.access && data.tokens.refresh) {
        await authLogin(data.tokens.access, data.tokens.refresh);
      } else if (data.access && data.refresh) {
        await authLogin(data.access, data.refresh);
      }

      router.replace('/(app)/user-home');
    } catch (error: any) {
      let errorMessage = 'ログインに失敗しました。';

      if (error.message) {
        if (error.message.includes('HTML') || error.message.includes('<')) {
          errorMessage = 'サーバーに接続できません。\nサーバーが起動しているか確認してください。';
        } else if (
          error.message.includes('credentials') ||
          error.message.includes('Invalid') ||
          error.message.includes('incorrect')
        ) {
          errorMessage = 'メールアドレスまたはパスワードが正しくありません。';
        } else if (error.message.includes('Network')) {
          errorMessage = 'ネットワークエラーが発生しました。\nインターネット接続を確認してください。';
        } else {
          errorMessage = error.message;
        }
      }

      Alert.alert('ログイン失敗', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = (): void => {
    router.push('./register');
  };

  const handleForgotPassword = (): void => {
    router.push('/password-reset' as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View
        style={[
          styles.container,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {/* タイトル */}
        <View style={styles.headerContainer}>
          <Text style={styles.icon}>🍃</Text>
          <Text style={styles.title}>NASシステム</Text>
        </View>

        {/* マスコットキャラクター */}
        <MascotCharacter size={130} />

        {/* タブグループ */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity
            style={[styles.tabButton, styles.tabButtonActive, styles.tabButtonLeft]}
            disabled
          >
            <Text style={[styles.tabButtonText, styles.tabButtonTextActive]}>
              ログイン
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, styles.tabButtonRight]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.tabButtonText}>新規利用者登録</Text>
          </TouchableOpacity>
        </View>

        {/* フォーム */}
        <View style={styles.form}>
          {/* メールアドレス */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Feather name="mail" size={14} color="#444" /> メールアドレス
            </Text>
            <View style={styles.inputWrapper}>
              <Feather name="at-sign" size={18} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="example@mail.com"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>
          </View>

          {/* パスワード */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>
              <Feather name="lock" size={14} color="#444" /> パスワード
            </Text>
            <View style={styles.passwordWrapper}>
              <Feather name="key" size={18} color="#999" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                placeholder="パスワードを入力"
                placeholderTextColor="#999"
                secureTextEntry={!isPasswordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles.togglePassword}
                onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Feather
                  name={isPasswordVisible ? 'eye' : 'eye-off'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* ログインボタン */}
          <TouchableOpacity
            style={[
              styles.loginButton,
              (loading || !email || !password) && styles.loginButtonDisabled,
            ]}
            onPress={handleLogin}
            disabled={loading || !email || !password}
            activeOpacity={0.8}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="white" size="small" />
                <Text style={styles.loginButtonText}>ログイン中...</Text>
              </View>
            ) : (
              <Text style={styles.loginButtonText}>🔓 ログイン</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* パスワード忘れ */}
        <TouchableOpacity
          onPress={handleForgotPassword}
          disabled={loading}
          activeOpacity={0.7}
          style={styles.forgotPasswordContainer}
        >
          <Feather name="help-circle" size={14} color="#0078D7" />
          <Text style={styles.forgotPassword}>パスワードを忘れた場合はこちら</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fef5e7',
  },
  container: {
    flex: 1,
    backgroundColor: '#fef5e7',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    fontSize: 36,
    marginRight: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    marginTop: 16,
    marginBottom: 20,
    maxWidth: 400,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: '#3498db',
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonLeft: {
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    marginRight: -2,
  },
  tabButtonRight: {
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  tabButtonText: {
    color: '#3498db',
    fontSize: 15,
    fontWeight: 'bold',
  },
  tabButtonTextActive: {
    color: 'white',
  },
  form: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: '#444',
    fontWeight: '600',
    fontSize: 15,
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    zIndex: 1,
  },
  input: {
    width: '100%',
    height: 48,
    paddingHorizontal: 12,
    paddingLeft: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    fontSize: 15,
    backgroundColor: '#f8f9fa',
    color: '#2c3e50',
  },
  passwordWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
  },
  togglePassword: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginButton: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#27ae60',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#27ae60',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#95a5a6',
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  forgotPasswordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  forgotPassword: {
    fontSize: 14,
    color: '#0078D7',
    textDecorationLine: 'underline',
  },
});