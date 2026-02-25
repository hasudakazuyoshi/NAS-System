# accounts/urls.py (修正版)

from django.urls import path
from . import views
from accounts.views import UserProfileUpdateAPIView, UserProfileGetAPIView, AppRedirectView, EmailVerificationAPIView

app_name = 'accounts'

urlpatterns = [
    path('login/', views.Authview.as_view(), name='login'),
    path('home/', views.UserHomeView.as_view(), name='user_home'),
    path('info/', views.UserProfileView.as_view(), name='user_info'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('register/', views.UserRegistrationView.as_view(), name='register'),
    path('pre_register/', views.UserRegistrationView.as_view(), name='pre_register'),
    path('profile/register/', views.UserProfileRegistrationView.as_view(), name='user_register'),
    
    # ✅ 修正: name を 'email_verification' に統一
    path('verify/', views.EmailVerificationView.as_view(), name='email_verification'),
    
    path('resend_verification/', views.EmailResendView.as_view(), name='resend_verification'),
    path('change_mail/', views.ChangeMailView.as_view(), name='change_mail'),
    path('change_password/', views.ChangePasswordView.as_view(), name='change_password'),
    path('change_mail/resend/', views.EmailResendView.as_view(), name='resend_email_change'),
    
    # ✅ 修正: アンダースコアをハイフンに変更
    path('verify-new-email/', views.VerifyNewEmailView.as_view(), name='verify_new_email'),
    
    path("api/get_profile/", UserProfileGetAPIView.as_view(), name="get_profile"),
    path("api/update_profile/", UserProfileUpdateAPIView.as_view(), name="update_profile"),
    path('password_reset/', views.UserPasswordResetView.as_view(), name='password_reset'),
    path('password_reset/done/', views.UserPasswordResetDoneView.as_view(), name='password_reset_done'),
    path('reset/<uidb64>/<token>/', views.UserPasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('reset/done/', views.UserPasswordResetCompleteView.as_view(), name='password_reset_complete'),

    path('api/verify-email/', EmailVerificationAPIView.as_view(), name='api_verify_email'),
    path('app-redirect/', AppRedirectView.as_view(), name='app_redirect'),
]