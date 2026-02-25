# # system_log/views_core.py など
# import json
# from typing import Dict, Any, Optional

# # LogServiceからコアなビジネスロジックを呼び出す
# from .services import LogService


# class LogAdminView:
#     """
#     [dispS107] アクセスログ管理画面のView層に相当するクラス。

#     ※ Djangoとは独立したロジック層。
#        Djangoのビューから呼び出して利用する。
#     """

#     @staticmethod
#     def get_system_logs_api(params: Dict[str, Optional[str]]) -> Dict[str, Any]:
#         """
#         アクセスログ一覧を取得する。
#         """
#         user_id = params.get("user_id")
#         start_time = params.get("start_time")
#         end_time = params.get("end_time")

#         try:
#             # --- サービス層のロジック呼び出し ---
#             logs_data = LogService.get_access_logs(
#                 user_id=user_id or None,
#                 start_time_str=start_time or None,
#                 end_time_str=end_time or None,
#             )

#             # --- 正常レスポンス ---
#             return {
#                 "success": True,
#                 "logs": logs_data,
#                 "log_count": len(logs_data),
#             }

#         except Exception as e:
#             # --- エラーレスポンス ---
#             return {
#                 "success": False,
#                 "message": f"ログデータの取得に失敗しました。詳細: {str(e)}",
#                 "logs": [],
#             }

#     @staticmethod
#     def record_login_api(user_id: str) -> Dict[str, Any]:
#         """
#         ログインイベントを記録するAPIラッパー
#         """
#         try:
#             LogService.log_session_start(user_id)
#             return {
#                 "success": True,
#                 "message": f"Login recorded for {user_id}",
#             }
#         except Exception as e:
#             return {
#                 "success": False,
#                 "message": f"Failed to record login: {str(e)}",
#             }

#     @staticmethod
#     def record_logout_api(user_id: str) -> Dict[str, Any]:
#         """
#         ログアウトイベントを記録するAPIラッパー
#         """
#         try:
#             LogService.log_session_end(user_id)
#             return {
#                 "success": True,
#                 "message": f"Logout recorded for {user_id}",
#             }
#         except Exception as e:
#             return {
#                 "success": False,
#                 "message": f"Failed to record logout: {str(e)}",
#             }
