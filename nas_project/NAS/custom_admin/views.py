# custom_admin/views.py
import json
import os
from django.conf import settings
from typing import Dict, List, Any
from django.views.generic import TemplateView, View
from django.contrib.auth.mixins import AccessMixin 
from django.shortcuts import redirect
from django.contrib.auth import get_user_model
from django.contrib import messages
from django.db import transaction
from django.urls import reverse 
from django.http import JsonResponse
import logging

# 💡 他アプリのインポート
from accounts.models import AdminUser 
from .services import AdminService 
from system_log.services import LogService # 💡 LogServiceをインポート

logger = logging.getLogger(__name__)

# settings.AUTH_USER_MODEL を取得
User = get_user_model() 

# ====================================================
# 共通ミックスイン：管理者のみアクセスを許可する
# ====================================================
class AdminAccessMixin(AccessMixin): 
    """
    ログイン済みかつ AdminUser のインスタンスであることを要求するミックスイン。
    権限がない場合は 'accounts:login' にリダイレクトする。
    """
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return self.handle_no_permission()
        
        if not isinstance(request.user, AdminUser):
            messages.error(request, "管理者としてログインしてください。")
            return redirect('accounts:login')
            
        return super().dispatch(request, *args, **kwargs)

    def handle_no_permission(self):
        return redirect('accounts:login') 

# ====================================================
# 既存の管理者関連ビュー (一部省略)
# ====================================================
class AdminHomeView(AdminAccessMixin, TemplateView):
    template_name = 'custom_admin/admin_home.html' 
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['user'] = self.request.user 
        return context

class AdminProfileView(AdminAccessMixin, TemplateView):
    template_name = 'custom_admin/admin_info.html'
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        try:
            admin_user = self.request.user 
            context['admin_id'] = admin_user.admin_id
            context['admin_email'] = admin_user.email
        except Exception as e:
            logger.error(f"[AdminProfile] 管理者情報取得エラー: {e}")
            context['error_message'] = '管理者情報の取得に失敗しました。'
        return context

class UserListAdminView(AdminAccessMixin, TemplateView):
    template_name = 'custom_admin/user_list.html' 
    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        try:
            user_list = AdminService.get_user_list()
            context['user_list'] = user_list
            context['user_count'] = len (user_list)
        except Exception as e:
            logger.error(f"[UserList] 利用者一覧取得エラー: {e}")
            context['user_list'] = []
            context['user_count'] = 0
            context['error_message'] = '利用者一覧の取得に失敗しました。'
        return context
    
# ----------------------------------------------------
# dispS104: 利用者削除処理 (POSTに対応)
# ----------------------------------------------------
class UserDeleteAdminView(AdminAccessMixin, View):
    def post(self, request, *args, **kwargs):
        list_url = reverse('custom_admin:user_list')
        ids_string = request.POST.get('delete_user_ids', '').strip()

        if not ids_string:
            messages.error(request, '削除する利用者を選択してください。')
            return redirect(list_url)

        # 💡 "NU00001,NU00002" のような形式に対応
        user_ids = [uid.strip() for uid in ids_string.split(',') if uid.strip()]

        if not user_ids:
            messages.error(request, '有効な利用者IDが見つかりませんでした。')
            return redirect(list_url)

        try:
            with transaction.atomic():
                delete_count = AdminService.delete_users_by_ids(user_ids)

                

                if delete_count > 0:
                    messages.success(request, f'{delete_count} 件の利用者を削除しました。')
                else:
                    messages.warning(request, '削除対象の利用者が見つかりませんでした。')

        except Exception as e:
            logger.exception(f"[USER_DELETE] 削除エラー: {e}")
            messages.error(request, '利用者削除中にエラーが発生しました。')

        return redirect(list_url)

# ====================================================
# dispS107: アクセスログ画面
# ====================================================

class AccessLogView(AdminAccessMixin, TemplateView):
    """
    [dispS107] アクセスログ管理画面のHTMLをレンダリングするビュー。
    """
    template_name = 'system_log/access_log.html'


class AccessLogDataAPIView(AdminAccessMixin, View):
    """
    [API] アクセスログデータをJSONで返すビュー。
    IDマッピングを作成し、Service層に渡してログを取得する。
    """

    def get(self, request):
        # 1. パラメータ抽出
        user_id = request.GET.get('searchInput')
        start_time = request.GET.get('startTime')
        end_time = request.GET.get('endTime')
        
        # 2. 💡 IDマッピングの作成
        user_mapping = self._get_user_id_mapping()
        logger.info(f"生成されたIDマッピング数: {len(user_mapping)}")
        logger.debug(f"IDマッピングのサンプル: {list(user_mapping.items())[:5]}")
        
        try:
            # 3. サービス層のコアロジックを呼び出す
            logs_data = LogService.get_access_logs(
                user_id=user_id or None,
                start_time_str=start_time or None,
                end_time_str=end_time or None,
                user_mapping=user_mapping # 👈 マッピングを渡す
            )
            
            # 4. 成功レスポンスを返却
            return JsonResponse(logs_data, safe=False)
            
        except Exception as e:
            # 5. エラー時
            error_message = f"ログデータの取得に失敗しました。詳細: {e}"
            logger.error(error_message)
            return JsonResponse(
                {"error": "ログデータの取得に失敗しました。", "logs": []}, 
                status=500
            )

    