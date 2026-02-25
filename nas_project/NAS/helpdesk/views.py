import json
from typing import Dict, Any, Optional
from .services import InquiryService
from .data_models import Inquiry
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required
from .models import HelpArticle
from .bot_logic import get_bot_response

# Django REST framework から APIView をインポート
from rest_framework.views import APIView 

# --- Gemini API (新SDK) ---
from google import genai
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

# 🔥 修正: configure() ではなく Client() を使う
# try:
#     api_key = getattr(settings, "GEMINI_API_KEY", None)
#     if api_key:
#         gemini_client = genai.Client(api_key=api_key)
#         logger.info("Gemini API初期化成功")
#     else:
#         gemini_client = None
#         logger.warning("GEMINI_API_KEYが設定されていません")
# except Exception as e:
#     gemini_client = None
#     logger.error(f"Gemini初期化エラー: {e}")


# ======================================================
# 画面表示用ビュー
# ======================================================
@login_required(login_url='/accounts/login/')
def inquiry_form(request):
    user_id = getattr(request.user, "user_id", None)
    return render(request, "helpdesk/inquiry_form.html", {"user_id": user_id})


def inquiry_page(request):
    user_id = getattr(request.user, "user_id", None)
    return render(request, "helpdesk/inquiry_list.html", {"user_id": user_id})


def inquiry_detail_page(request, user_id, inquiry_id):
    print(f"🧩 inquiry_detail_page user_id={user_id}, inquiry_id={inquiry_id}")
    return render(request, "helpdesk/inquiry_response.html", {
        "inquiry_id": inquiry_id,
        "user_id": user_id,
    })


# ======================================================
# ヘルプデスク問い合わせ API(Service層ラッパー)
# ======================================================
class InquiryView:
    @staticmethod
    def get_inquiry_list_api(user_id: Optional[str] = None) -> Dict[str, Any]:
        try:
            inquiries_data = InquiryService.get_inquiries(user_id=user_id)
            return {
                "success": True,
                "inquiries": inquiries_data,
                "inquiry_count": len(inquiries_data)
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"問い合わせ一覧の取得に失敗しました。詳細: {str(e)}",
                "inquiries": []
            }

    @staticmethod
    def get_inquiry_detail_api(user_id: str, inquiry_id: str) -> Dict[str, Any]:
        try:
            detail = InquiryService.get_inquiry_detail(user_id, inquiry_id)
            if not detail:
                return {"success": False, "message": "指定された問い合わせは見つかりませんでした。"}
            return {"success": True, "detail": detail}
        except Exception as e:
            return {"success": False, "message": f"問い合わせ詳細の取得に失敗しました。詳細: {str(e)}"}

    @staticmethod
    def register_new_inquiry_api(user_id: str, inquiry_name: str, initial_message: str) -> Dict[str, Any]:
        if not all([user_id, inquiry_name, initial_message]):
            return {"success": False, "message": "利用者ID、件名、およびメッセージは必須です。"}

        try:
            new_inquiry = InquiryService.register_new_inquiry(
                user_id=user_id,
                inquiry_name=inquiry_name,
                initial_message=initial_message
            )
            return {
                "success": True,
                "message": "問い合わせを登録しました。",
                "inquiry_id": new_inquiry.inquiryID
            }
        except Exception as e:
            return {"success": False, "message": f"問い合わせの登録中にエラーが発生しました。詳細: {str(e)}"}

    @staticmethod
    def add_user_message_api(user_id: str, inquiry_id: str, user_message: str) -> Dict[str, Any]:
        if not all([user_id, inquiry_id, user_message]):
            return {"success": False, "message": "利用者ID、問い合わせID、およびメッセージは必須です。"}

        try:
            updated_inquiry = InquiryService.add_user_message(
                user_id=user_id,
                inquiry_id=inquiry_id,
                message=user_message
            )
            if not updated_inquiry:
                return {"success": False, "message": "指定された問い合わせが見つかりませんでした。"}
            return {"success": True, "message": "メッセージを送信しました。", "status": updated_inquiry.status}
        except Exception as e:
            return {"success": False, "message": f"メッセージ送信中にエラーが発生しました。詳細: {str(e)}"}

    @staticmethod
    def add_response_api(user_id: str, inquiry_id: str, admin_response: str) -> Dict[str, Any]:
        if not all([user_id, inquiry_id, admin_response]):
            return {"success": False, "message": "利用者ID、問い合わせID、および応答メッセージは必須です。"}

        try:
            updated_inquiry = InquiryService.add_response(user_id, inquiry_id, admin_response)
            if not updated_inquiry:
                return {"success": False, "message": "指定された問い合わせが見つかりませんでした。"}

            return {"success": True, "message": "応答を送信しました。", "status": updated_inquiry.status}
        except Exception as e:
            return {"success": False, "message": f"応答の追加中にエラーが発生しました。詳細: {str(e)}"}

    @staticmethod
    def close_inquiry_api(user_id: str, inquiry_id: str) -> Dict[str, Any]:
        if not all([user_id, inquiry_id]):
            return {"success": False, "message": "利用者IDと問い合わせIDは必須です。"}

        try:
            updated_inquiry = InquiryService.close_inquiry(user_id, inquiry_id)
            if not updated_inquiry:
                return {"success": False, "message": "指定された問い合わせが見つかりません。"}

            return {"success": True, "message": "問い合わせを解決済みにしました。", "status": updated_inquiry.status}
        except Exception as e:
            return {"success": False, "message": f"ステータス更新中にエラーが発生しました。詳細: {str(e)}"}


# ======================================================
# Django API View (REST API スタイルの新しいビュー群)
# ======================================================

# 1. 問い合わせ一覧取得 (GET /api/inquiries/)
class InquiryListAPIView(APIView):
    def get(self, request, *args, **kwargs):
        user_id = request.GET.get("user_id") 
        result = InquiryView.get_inquiry_list_api(user_id)
        return JsonResponse(result, safe=False)

# 2. 新規問い合わせ作成 (POST /api/inquiries/new/)
class InquiryNewAPIView(APIView):
    def post(self, request, *args, **kwargs):
        data = request.data
            
        result = InquiryView.register_new_inquiry_api(
            user_id=data.get("user_id"),
            inquiry_name=data.get("inquiry_name"),
            initial_message=data.get("initial_message"),
        )
        return JsonResponse(result, safe=False)

# 3. 問い合わせ詳細取得 (GET /api/inquiries/<str:user_id>/<str:inquiry_id>/)
class InquiryDetailAPIView(APIView):
    def get(self, request, user_id, inquiry_id, *args, **kwargs):
        result = InquiryView.get_inquiry_detail_api(user_id, inquiry_id)
        return JsonResponse(result, safe=False)

# 4. メッセージ送信 (POST /api/inquiries/<str:user_id>/<str:inquiry_id>/response/)
class InquiryResponseAPIView(APIView):
    def post(self, request, user_id, inquiry_id, *args, **kwargs):
        data = request.data

        if request.user.is_staff:
            # 管理者からの応答
            result = InquiryView.add_response_api(
                user_id=user_id,
                inquiry_id=inquiry_id,
                admin_response=data.get("admin_response") or data.get("message"),
            )
        else:
            # ユーザーからのメッセージ
            result = InquiryView.add_user_message_api(
                user_id=user_id,
                inquiry_id=inquiry_id,
                user_message=data.get("message"),
            )
        return JsonResponse(result, safe=False)

# 5. 問い合わせクローズ (POST /api/inquiries/<str:user_id>/<str:inquiry_id>/close/)
class InquiryCloseAPIView(APIView):
    def post(self, request, user_id, inquiry_id, *args, **kwargs):
        result = InquiryView.close_inquiry_api(user_id, inquiry_id)
        return JsonResponse(result, safe=False)


# ======================================================
# チャット画面
# ======================================================
@login_required(login_url='/accounts/login/')
def chatbot_page(request):
    return render(request, "helpdesk/help.html")


# ======================================================
# チャットボット API
# ======================================================
@csrf_exempt
def chatbot_api(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        # JSON安全読み込み
        try:
            data = json.loads(request.body.decode("utf-8")) if request.body else {}
        except json.JSONDecodeError:
            data = {}

        message = (data.get("message") or "").strip()
        if not message:
            return JsonResponse({"response": "メッセージが空です。"}, status=400)

        # User ID の安全取得
        user_id = str(request.user.pk) if request.user.is_authenticated else "guest"

        # DBのヘルプ記事検索
        article = HelpArticle.objects.filter(title__icontains=message).first()
        if article:
            return JsonResponse({"response": article.content})

        # Gemini へ質問
        response_text = get_bot_response(user_id, message)

        return JsonResponse({"response": response_text})

    except Exception as e:
        print("chatbot_api ERROR:", e)
        return JsonResponse({"error": str(e)}, status=500)