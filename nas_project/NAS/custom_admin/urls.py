# Nas/admin/urls.py

from django.urls import path
# UserListAdminView をインポートに追加
from .views import AdminHomeView, AdminProfileView, UserListAdminView 
from . import views
from system_log.views import AccessLogView, AccessLogDataAPIView  # 💡 APIビューを追加

app_name = 'custom_admin'

urlpatterns = [
    # dispS103: 管理者ホーム画面
    path('', AdminHomeView.as_view(), name='admin_home'),
    
    # dispS108: 管理者情報画面
    path('admin_info/', AdminProfileView.as_view(), name='admin_info'),
    
    # dispS104: 利用者情報一覧画面
    path('user_list/', UserListAdminView.as_view(), name='user_list'), 

    path('users/delete/', views.UserDeleteAdminView.as_view(), name='user_delete'),

    # dispS107: アクセスログ画面
    path('access_log', AccessLogView.as_view(), name='access_log'),

    # 💡 アクセスログデータAPI (新規追加)
    path('api/access_log_data', AccessLogDataAPIView.as_view(), name='access_log_data_api'),
]