// context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { logout as apiLogout, getTokens, storeTokens, validateToken } from '../api/apiService'; // 💡 logout をインポート

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  setIsAuthenticated: (value: boolean) => void;
  login: (accessToken: string, refreshToken: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // アプリ起動時の認証チェック
  const checkAuth = async () => {
    try {
      console.log('🔍 認証状態チェック開始...');
      const { accessToken } = await getTokens();
      
      if (accessToken) {
        const isValid = await validateToken();
        setIsAuthenticated(isValid);
        console.log(isValid ? '✅ 認証済み' : '🔓 トークン無効');
      } else {
        setIsAuthenticated(false);
        console.log('🔓 未認証');
      }
    } catch (error) {
      console.error('❌ 認証チェックエラー:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  // ログイン処理
  const login = async (accessToken: string, refreshToken: string) => {
    try {
      console.log('📝 認証状態を更新中...');
      await storeTokens(accessToken, refreshToken);
      setIsAuthenticated(true);
      console.log('✅ ログイン状態に変更完了');
    } catch (error) {
      console.error('❌ ログイン状態更新エラー:', error);
      throw error;
    }
  };

  // ログアウト処理
  const logout = async () => {
    try {
      console.log('🚪 ログアウト処理開始...');
      
      // 💡 ログアウトAPIを呼び出す
      await apiLogout();
      
      setIsAuthenticated(false);
      console.log('✅ ログアウト完了 - 認証状態をfalseに変更');
    } catch (error) {
      console.error('❌ ログアウトエラー:', error);
      // エラーでも認証状態はクリア
      setIsAuthenticated(false);
      throw error;
    }
  };

  // 初回マウント時に認証チェック
  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        setIsAuthenticated,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};