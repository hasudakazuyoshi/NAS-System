# api/auth/urls.py

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    # 新しい登録フロー
    PreRegistrationAPIView,
    EmailVerificationAPIView,
    CompleteRegistrationAPIView,
    
    # 認証関連
    UserLoginView,
    UserLogoutView,
    UserMeView,
    PasswordChangeView,
    
    # パスワードリセット
    PasswordResetRequestAPIView,
    PasswordResetConfirmAPIView,
    PasswordResetTokenVerifyAPIView,      # ✅ 追加
    PasswordResetByUserIdAPIView,         # ✅ 追加
    
    # メールアドレス変更
    EmailChangeRequestAPIView,
    EmailChangeConfirmAPIView,
    
    # デバイス関連
    DeviceRegisterView,
    DeviceListView,
    DeviceDeleteView,
    
    # アカウント削除
    UserDeleteView,
)

urlpatterns = [
    # ==================== 新規登録フロー ====================
    path('pre-register/', PreRegistrationAPIView.as_view(), name='pre-register'),
    path('verify-email/', EmailVerificationAPIView.as_view(), name='verify-email'),
    path('complete-registration/', CompleteRegistrationAPIView.as_view(), name='complete-registration'),
    
    # ==================== 認証 ====================
    path('login/', UserLoginView.as_view(), name='user-login'),
    path('logout/', UserLogoutView.as_view(), name='user-logout'),
    path('me/', UserMeView.as_view(), name='user-me'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    
    # ==================== パスワード管理 ====================
    # ログイン中のパスワード変更
    path('password/change/', PasswordChangeView.as_view(), name='password-change'),
    
    # パスワードリセット（ログイン不要）
    path('password/reset/', PasswordResetRequestAPIView.as_view(), name='password-reset'),
    path('password/reset/confirm/', PasswordResetConfirmAPIView.as_view(), name='password-reset-confirm'),
    
    # パスワードリセット（新規登録方式）✅ 追加
    path('password-reset-token-verify/', PasswordResetTokenVerifyAPIView.as_view(), name='password_reset_token_verify'),
    path('password-reset-by-userid/', PasswordResetByUserIdAPIView.as_view(), name='password_reset_by_userid'),
    
    # ==================== メールアドレス変更 ====================
    path('email/change/', EmailChangeRequestAPIView.as_view(), name='email-change'),
    path('email/change/confirm/', EmailChangeConfirmAPIView.as_view(), name='email-change-confirm'),
    
    # ==================== デバイス管理 ====================
    path('devices/', DeviceListView.as_view(), name='device-list'),
    path('devices/register/', DeviceRegisterView.as_view(), name='device-register'),
    path('devices/<int:pk>/', DeviceDeleteView.as_view(), name='device-delete'),
    
    # ==================== アカウント削除 ====================
    path('delete/', UserDeleteView.as_view(), name='user-delete'),
]