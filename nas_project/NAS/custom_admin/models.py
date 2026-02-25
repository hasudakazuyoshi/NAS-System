# Nas/admin/models.py

from django.db import models
from django.conf import settings # settings.AUTH_USER_MODELを参照するためにインポート
import uuid 

# class AdminProfile(models.Model):
#     """
#     管理者固有のデータモデル (dispS108の表示に必要な情報)
#     認証はdjango.contrib.auth.models.Userに依存
#     """
#     # ユーザーモデルとの一対一の紐づけ
#     user = models.OneToOneField(
#         settings.AUTH_USER_MODEL, 
#         on_delete=models.CASCADE,
#         primary_key=True
#         ) 
    
#     # 独自の管理者ID (例: NA00000)
#     is_super_admin = models.BooleanField(default=False, verbose_name="スーパー管理者")
    
#     def __str__(self):
#         return f"{self.admin_id} ({self.user.email})"
    
#     class Meta:
#         # モデルが配置されているアプリケーション名（パッケージ名）
#         app_label = 'custom_admin'