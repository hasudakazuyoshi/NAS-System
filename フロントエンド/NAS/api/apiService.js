// api/apiService.ts (自動トークンリフレッシュ対応版)
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'https://lacrimal-valleylike-lilyana.ngrok-free.dev/api';

// ==================== トークン管理 ====================

export const storeTokens = async (accessToken, refreshToken) => {
  try {
    await AsyncStorage.setItem('accessToken', accessToken);
    await AsyncStorage.setItem('refreshToken', refreshToken);
  } catch (error) {
    // エラーは無視
  }
};

export const getTokens = async () => {
  try {
    const accessToken = await AsyncStorage.getItem('accessToken');
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    return { accessToken, refreshToken };
  } catch (error) {
    return { accessToken: null, refreshToken: null };
  }
};

export const clearTokens = async () => {
  try {
    const keys = ['access_token', 'refresh_token', 'accessToken', 'refreshToken', 'tempToken', 'user_id'];
    await AsyncStorage.multiRemove(keys);
  } catch (error) {
    // エラーは無視
  }
};

// ==================== トークン検証 ====================

export const validateToken = async () => {
  try {
    const { accessToken } = await getTokens();
    
    if (!accessToken) {
      return false;
    }

    const response = await fetch(`${API_BASE_URL}/auth/me/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      return true;
    } else {
      await clearTokens();
      return false;
    }
  } catch (error) {
    return false;
  }
};

// ==================== トークンリフレッシュ ====================

export const refreshAccessToken = async () => {
  try {
    const { refreshToken } = await getTokens();
    
    if (!refreshToken) {
      throw new Error('リフレッシュトークンがありません');
    }

    const response = await fetch(`${API_BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });

    if (!response.ok) {
      throw new Error('トークンリフレッシュ失敗');
    }

    const data = await response.json();
    
    if (data.access) {
      await AsyncStorage.setItem('accessToken', data.access);
      
      if (data.refresh) {
        await AsyncStorage.setItem('refreshToken', data.refresh);
      }
      
      return data.access;
    }

    throw new Error('新しいアクセストークンを取得できませんでした');
    
  } catch (error) {
    await clearTokens();
    throw error;
  }
};

// ==================== 汎用API呼び出し (自動リフレッシュ対応) ====================

export const apiCall = async (endpoint, method = 'GET', body = null, requiresAuth = true) => {
  try {
    const url = `${API_BASE_URL}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
    };

    if (requiresAuth) {
      const { accessToken } = await getTokens();
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      } else {
        throw new Error('認証トークンがありません。ログインしてください。');
      }
    }

    const config = {
      method,
      headers,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    let response = await fetch(url, config);
    
    // 401エラー時の自動リフレッシュ処理
    if (response.status === 401 && requiresAuth) {
      const { refreshToken } = await getTokens();
      
      if (!refreshToken) {
        await clearTokens();
        throw new Error('セッションが切れました。再度ログインしてください。');
      }
      
      try {
        const newAccessToken = await refreshAccessToken();
        
        headers['Authorization'] = `Bearer ${newAccessToken}`;
        config.headers = headers;
        
        response = await fetch(url, config);
      } catch (refreshError) {
        await clearTokens();
        throw new Error('セッションが切れました。再度ログインしてください。');
      }
    }
    
    const responseText = await response.text();

    if (responseText.startsWith('<')) {
      throw new Error(`エンドポイント ${endpoint} が存在しません。ステータス: ${response.status}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`JSONパースエラー: ${responseText.substring(0, 100)}`);
    }

    if (!response.ok) {
      let errorMessage = `エラー: ${response.status}`;
      
      if (data.detail) {
        errorMessage = data.detail;
      } else if (data.error) {
        errorMessage = data.error;
      } else if (data.message) {
        errorMessage = data.message;
      }
      
      if (response.status === 401) {
        await clearTokens();
        throw new Error('セッションが切れました。再度ログインしてください。');
      }

      throw new Error(errorMessage);
    }

    return data;

  } catch (error) {
    throw error;
  }
};

// ==================== 認証API ====================

export const preRegister = async (email) => {
  return await apiCall('/auth/pre-register/', 'POST', { email }, false);
};

export const verifyEmailToken = async (token) => {
  const url = `${API_BASE_URL}/auth/verify-email/?token=${token}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    const responseText = await response.text();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      throw new Error('サーバーから不正なレスポンスが返されました');
    }
    
    if (response.ok && data.success) {
      await AsyncStorage.setItem('access_token', data.access_token);
      await AsyncStorage.setItem('refresh_token', data.refresh_token);
      await AsyncStorage.setItem('user_id', String(data.user_id));
    }
    
    return data;
  } catch (error) {
    throw error;
  }
};

// ✅ Web用メール認証（旧verifyEmail関数 - 念のため残す）
export const verifyEmail = async (token) => {
  const data = await apiCall('/auth/verify-email/', 'POST', { token }, false);
  if (data.temp_token) {
    await AsyncStorage.setItem('tempToken', data.temp_token.access);
    await AsyncStorage.setItem('tempRefresh', data.temp_token.refresh);
  }
  return data;
};

export const completeRegistration = async (registrationData) => {
  const accessToken = await AsyncStorage.getItem('access_token');
  const url = `${API_BASE_URL}/auth/complete-registration/`;
  
  if (!accessToken) {
    throw new Error('メール認証が完了していません。再度メール認証を行ってください。');
  }
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(registrationData),
    });
    
    const responseText = await response.text();
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (error) {
      throw new Error('サーバーから不正なレスポンスが返されました');
    }
    
    if (response.ok && data.success && data.token) {
      await storeTokens(data.token.access, data.token.refresh);
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('user_id');
    } else if (!response.ok) {
      throw new Error(data.error || data.detail || '登録に失敗しました');
    }
    
    return data;
  } catch (error) {
    throw error;
  }
};

export const login = async (email, password) => {
  await clearTokens();
  
  const data = await apiCall('/auth/login/', 'POST', { email, password }, false);
  
  if (data.tokens && data.tokens.access && data.tokens.refresh) {
    await storeTokens(data.tokens.access, data.tokens.refresh);
  } else if (data.access && data.refresh) {
    await storeTokens(data.access, data.refresh);
  }
  
  return data;
};

export const logout = async () => {
  try {
    // 💡 refresh_tokenを取得して送信
    const { refreshToken } = await getTokens();
    
    await apiCall('/auth/logout/', 'POST', { 
      refresh: refreshToken 
    }, true);
  } catch (error) {
    // エラーは無視
  } finally {
    await clearTokens();
  }
};

export const changePassword = async (oldPassword, newPassword, newPasswordConfirm) => {
  return await apiCall('/auth/password/change/', 'POST', {
    old_password: oldPassword,
    new_password: newPassword,
    new_password_confirm: newPasswordConfirm,
  }, true);
};

export const requestEmailChange = async (newEmail, password) => {
  return await apiCall('/auth/email/change/', 'POST', {
    new_email: newEmail,
    password: password
  }, true);
};

export const confirmEmailChange = async (token) => {
  return await apiCall('/auth/email/change/confirm/', 'POST', { token }, false);
};

export const requestPasswordReset = async (email) => {
  return await apiCall('/auth/password/reset/', 'POST', { email }, false);
};

export const confirmPasswordReset = async (uid, token, newPassword, confirmPassword) => {
  return await apiCall('/auth/password/reset/confirm/', 'POST', {
    uid,
    token,
    new_password: newPassword,
    new_password_confirm: confirmPassword
  }, false);
};

// ==================== パスワードリセット（新規登録方式） ====================

export const verifyPasswordResetToken = async (uid, token) => {
  return await apiCall('/auth/password-reset-token-verify/', 'POST', {
    uid,
    token
  }, false);
};

export const resetPasswordByUserId = async (userId, newPassword) => {
  return await apiCall('/auth/password-reset-by-userid/', 'POST', {
    user_id: userId,
    new_password: newPassword
  }, false);
};

// ==================== ユーザー情報API ====================

export const getUserInfo = async () => {
  return await apiCall('/auth/me/', 'GET', null, true);
};

export const updateUserInfo = async (userData) => {
  return await apiCall('/auth/me/', 'PATCH', userData, true);
};

export const deleteAccount = async () => {
  return await apiCall('/auth/delete/', 'DELETE', {}, true);
};

// ==================== ヘルプデスク/問い合わせAPI ====================

export const getInquiries = async () => {
  return await apiCall('/helpdesk/inquiries/', 'GET', null, true);
};

export const createInquiry = async (inquiryDataOrName, initialMessage) => {
  let inquiryData;
  
  if (typeof inquiryDataOrName === 'string' && initialMessage !== undefined) {
    inquiryData = {
      inquiry_name: inquiryDataOrName,
      initial_message: initialMessage
    };
  } else if (typeof inquiryDataOrName === 'object' && inquiryDataOrName !== null) {
    inquiryData = inquiryDataOrName;
  } else {
    throw new Error('createInquiryはオブジェクトまたは(name, message)の形式で呼び出してください');
  }
  
  if (!inquiryData.inquiry_name) {
    throw new Error('inquiry_nameは必須です');
  }
  
  if (!inquiryData.initial_message) {
    throw new Error('initial_messageは必須です');
  }
  
  return await apiCall('/helpdesk/inquiries/new/', 'POST', inquiryData, true);
};

export const getInquiryDetail = async (inquiryId) => {
  return await apiCall(`/helpdesk/inquiries/${inquiryId}/`, 'GET', null, true);
};

export const addInquiryMessage = async (inquiryId, message) => {
  return await apiCall(`/helpdesk/inquiries/${inquiryId}/message/`, 'POST', { message }, true);
};

export const closeInquiry = async (inquiryId) => {
  return await apiCall(`/helpdesk/inquiries/${inquiryId}/close/`, 'POST', {}, true);
};

export const sendMessage = async (inquiryId, message) => {
  return await addInquiryMessage(inquiryId, message);
};

// ==================== 健康データAPI ====================

export const getWeeklyHealthData = async (weeksAgo = 0) => {
  const endpoint = `/health/weekly/body/?weeks_ago=${weeksAgo}`;
  return await apiCall(endpoint, 'GET', null, true);
};

export const getWeeklySleepData = async (weeksAgo = 0) => {
  const endpoint = `/health/weekly/sleep/?weeks_ago=${weeksAgo}`;
  return await apiCall(endpoint, 'GET', null, true);
};

export const getHealthDataList = async () => {
  return await apiCall('/health/data/', 'GET', null, true);
};

export const getSleepDataList = async () => {
  return await apiCall('/health/sleep/', 'GET', null, true);
};

export const postHealthData = async (healthData) => {
  return await apiCall('/health/data/', 'POST', healthData, true);
};

export const postSleepData = async (sleepData) => {
  return await apiCall('/health/sleep/', 'POST', sleepData, true);
};

export const getHealthSummary = async () => {
  return await apiCall('/health/summary/', 'GET', null, true);
};

// ==================== チャットボットAPI ====================

export const sendChatbotMessage = async (message) => {
  return await apiCall('/helpdesk/chatbot/', 'POST', { message }, true);
};

export const getChatHistory = async () => {
  return { history: [] };
};

// ==================== エクスポート ====================

export default {
  storeTokens,
  getTokens,
  clearTokens,
  validateToken,
  apiCall,
  preRegister,
  verifyEmailToken,
  verifyEmail,
  completeRegistration,
  login,
  logout,
  changePassword,
  requestEmailChange,
  confirmEmailChange,
  requestPasswordReset,
  confirmPasswordReset,
  verifyPasswordResetToken,      // ✅ 追加
  resetPasswordByUserId,          // ✅ 追加
  getUserInfo,
  updateUserInfo,
  deleteAccount,
  refreshAccessToken,
  getInquiries,
  createInquiry,
  getInquiryDetail,
  addInquiryMessage,
  closeInquiry,
  sendMessage,
  getWeeklyHealthData,
  getWeeklySleepData,
  getHealthDataList,
  getSleepDataList,
  postHealthData,
  postSleepData,
  getHealthSummary,
  sendChatbotMessage,
  getChatHistory,
};