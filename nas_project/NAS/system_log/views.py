# system_log/views.py

from typing import Optional
from django.shortcuts import render
from django.views import View
from django.http import JsonResponse
from django.contrib.auth.mixins import UserPassesTestMixin
import logging

from .services import LogService 

logger = logging.getLogger(__name__)


# ======================================================
# 共通Mixin: 管理者権限チェック
# ======================================================
class AdminRequiredMixin(UserPassesTestMixin):
    """管理者のみアクセスを許可するMixin"""
    def test_func(self):
        return self.request.user.is_authenticated and self.request.user.is_staff 


# ======================================================
# 画面表示ビュー (HTMLレンダリング)
# ======================================================
class AccessLogView(AdminRequiredMixin, View):
    """
    [dispS107] アクセスログ管理画面のHTMLをレンダリングするビュー。
    """
    def get(self, request):
        return render(request, 'system_log/access_log.html')


# ======================================================
# APIビュー (データ提供)
# ======================================================
class AccessLogDataAPIView(AdminRequiredMixin, View):
    """
    [API] アクセスログデータをJSONで返すビュー。
    LogServiceを直接呼び出し、フィルタリング後のデータを取得する。
    """

    def get(self, request):
        # 1. リクエストパラメータを抽出
        user_id = request.GET.get('searchInput')
        start_time = request.GET.get('startTime')
        end_time = request.GET.get('endTime')
        
        try:
            # 2. サービス層のコアロジックを直接呼び出す
            logs_data = LogService.get_access_logs(
                user_id=user_id or None,
                start_time_str=start_time or None,
                end_time_str=end_time or None,
            )
            
            # 3. 成功レスポンスを返却
            return JsonResponse(logs_data, safe=False)
            
        except Exception as e:
            # 4. エラー時
            error_message = f"ログデータの取得に失敗しました。詳細: {e}"
            logger.error(error_message)
            return JsonResponse(
                {"error": error_message, "logs": []}, 
                status=500
            )