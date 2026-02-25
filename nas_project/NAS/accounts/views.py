from django.shortcuts import render,redirect
from django.urls import reverse, reverse_lazy
from django.views import View
from django.contrib.auth import login as auth_login, logout as auth_logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
import json
from django.contrib.auth.mixins import LoginRequiredMixin
from django.http import JsonResponse
from common.exceptions import NASException
from common.dtos import  UserProfileDto, PreRegistrationDto 
from accounts.service import AuthService, UserService
from accounts.models import User ,AdminUser,Device
from mail.services import MailService
from .forms import UserProfileRegistrationForm
from common.logger import log_action
from django.contrib.auth import authenticate
from accounts.service import EmailChangeService
from django.contrib import messages
from django.contrib.auth import logout
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from datetime import date
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from system_log.services import LogService  # 💡 追加



class Authview(View):
    """ログイン画面と認証処理"""

    template_name = 'accounts/login.html'

    def get(self, request):
        """ログイン画面の表示 or すでにログイン済みならリダイレクト"""
        if request.user.is_authenticated:
            if isinstance(request.user, AdminUser):
                return redirect(reverse('custom_admin:admin_home'))
            elif isinstance(request.user, User):
                return redirect(reverse('accounts:user_home'))
            # fallback(万が一)
            return redirect(reverse('accounts:user_home'))

        return render(request, self.template_name)

    def post(self, request):
        """ログイン処理"""
        email = request.POST.get('email', '').strip()
        password = request.POST.get('password', '')

        # Djangoのauthenticate()が UserOrAdminBackend を呼び出す
        authenticated_user = authenticate(request, email=email, password=password)

        # 認証失敗時
        if authenticated_user is None:
            context = {'error_message': 'メールアドレスまたはパスワードが正しくありません。'}
            return render(request, self.template_name, context, status=401)

        # 認証成功時:セッションにログイン
        auth_login(request, authenticated_user, backend='accounts.backends.UserOrAdminBackend')

        # 💡 アクセスログ記録
        LogService.log_session_start(authenticated_user)

        # 種類に応じたログ出力とリダイレクト
        user_type = getattr(authenticated_user, "_user_type", "")

        if user_type == "admin":
            log_action(authenticated_user, authenticated_user.email, "管理者ログイン")
            return redirect(reverse('custom_admin:admin_home'))

        elif user_type == "user":
            log_action(authenticated_user, authenticated_user.email, "利用者ログイン")
            return redirect(reverse('accounts:user_home'))

        # fallback(_user_type が付与されていない場合でも安全に)
        log_action(authenticated_user, authenticated_user.email, "不明な種別のログイン")
        return redirect(reverse('accounts:user_home'))


class UserRegistrationView(View):

    template_name_pre_reg = 'accounts/register.html'
    template_name_pre_complete = 'accounts/pre_register.html'

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.auth_service = AuthService()
        self.mail_service = MailService()
    
    def get(self, request):
        return render(request, self.template_name_pre_reg)
    
    def post(self, request):
        email = request.POST.get('email')
        
        dto = PreRegistrationDto(email=email)

        try:
            # サービス層で仮登録とトークン発行を行う
            token = self.auth_service.register_pre_user(dto)
            
            # ✅ app-redirect を経由するように修正
            base_url = request.build_absolute_uri('/').rstrip('/')
            web_verify_url = f"{base_url}/accounts/app-redirect/?token={token}&action=verify-email"
            
            # アプリ用: 直接ディープリンク
            app_url = f"nasapp://verify?token={token}"
            
            # メール送信処理(URL2つを渡す)
            self.mail_service.send_verification_email(
                email=dto.email,
                token=token,
                request=request,
                web_url=web_verify_url,  # ✅ app-redirect を経由
                app_url=app_url
            )
            
            context = {'email': email}
            return render(request, self.template_name_pre_complete, context)
        
        except NASException as e:
            context = {
                'error_message': e.message,
                'email': email,
            }
            return render(request, self.template_name_pre_reg, context, status=400)

class EmailResendView(View):
    """
    再送信処理:
    purpose に応じて処理とテンプレートを分岐させる
    - register → 仮登録メール
    - change   → メールアドレス変更確認メール
    - reset    → パスワードリセットメール
    """

    def post(self, request):
        email = request.POST.get('email')
        purpose = request.GET.get('purpose')

        if not email or not purpose:
            return render(request, 'common/error.html', {
                'error_message': 'メールアドレスまたは目的が不明です。'
            })

        try:
            # --------------- 新規登録 再送 ---------------
            if purpose == "register":
                # regenerate_pre_register_token を呼ぶのではなく、
                # 共通の register_pre_user を呼ぶことで、常に最新のトークンを発行・送信させます
                dto = PreRegistrationDto(email=email)
                token = AuthService().register_pre_user(dto)
                
                # ✅ URL生成ロジックは既存のままでOK
                web_verify_url = request.build_absolute_uri(
                    reverse('accounts:email_verification')
                ) + f'?token={token}'
                app_url = f"nasapp://verify?token={token}"
                
                # メッセージを出して完了画面を表示
                messages.success(request, "仮登録メールを再送しました。")
                return render(request, 'accounts/pre_register.html', {"email": email})

            # --------------- メール変更 再送 ---------------
            elif purpose == "change":
                # ✅ request引数を追加
                EmailChangeService().resend_change_email(request, email)
                messages.success(request, "メール変更確認メールを再送しました。")
                return render(request, 'accounts/change_mail_sent.html', {"email": email})

            # --------------- パスワードリセット 再送 ---------------
            elif purpose == "reset":
                user = User.objects.get(email=email)
                token = default_token_generator.make_token(user)
                uid = urlsafe_base64_encode(force_bytes(user.pk))
                
                # ✅ 相対パスで生成(UserPasswordResetViewと同じ)
                reset_url = reverse('accounts:password_reset_confirm', kwargs={'uidb64': uid, 'token': token})
                
                # ✅ シンプルに呼び出し
                MailService.send_password_reset_email(
                    user=user,
                    reset_url=reset_url,
                    request=request
                )

                messages.success(request, "パスワードリセットメールを再送しました。")
                return render(request, 'accounts/password_reset_done.html', {"email": email})

            # --------------- 不正 purpose ---------------
            else:
                return render(request, 'common/error.html', {
                    'error_message': '不正なメール再送要求です。'
                })

        except NASException as e:
            return render(request, 'common/error.html', {"error_message": e.message})
        except Exception as e:
            return render(request, 'common/error.html', {"error_message": str(e)})




class EmailVerificationView(View):
    auth_service = AuthService()

    template_name_verification_complete = "accounts/verification_complete.html"

    def get(self, request, *args, **kwargs):
        token = request.GET.get('token', '')
        if not token:
            raise NASException("無効なメール認証です。")   # URLにtokenがない

        try:
            # 🔥 タプルで受け取る(temp_tokenは使わない)
            user, temp_token = self.auth_service.verify_and_activate_user(token)

            # ★ デバッグログ
            print("DEBUG: verified user:", user.pk)
            print("DEBUG: is_active:", user.is_active)
            print("DEBUG: user.is_authenticated(before login):", user.is_authenticated)

            
            # 本人確認完了画面
            return render(request, self.template_name_verification_complete, {
                'user_id': user.pk
            })

        except NASException as e:
            print("Error in EmailVerificationView:", str(e))
            raise e



        

class UserProfileRegistrationView(View):

    # login_url = reverse_lazy('accounts:login')  # ログインしていない場合のリダイレクト先
    template_name = 'accounts/user_register.html'  # 本登録画面のテンプレート名
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.user_service = UserService()
    
    def get(self, request):

        """本登録画面の表示処理"""
        # if request.user.is_active:
            # return redirect(reverse('accounts:user_home'))
        user_id = request.GET.get('user_id')

        if not user_id:

            return redirect(reverse('accounts:login'))
        
        try:

            user_to_register = User.objects.get(pk=user_id)

        except User.DoesNotExist:
            return redirect(reverse('accounts:login'))
        
         # ユーザーIDに基づいてユーザー情報を取得し、フォームの初期値として設定

        form = UserProfileRegistrationForm(initial={'email': user_to_register.email})
        return render(request, self.template_name, {'form': form, 'user_id': user_id})
    
    def post(self, request):

        """登録ボタン押下時の処理"""
        user_id = request.POST.get('user_id')
        error_message = None
       

        form = UserProfileRegistrationForm(request.POST)

        if form.is_valid():
            print("--- DEBUG: バリデーション成功 ---")
            cleaned_data = form.cleaned_data
        
            # 💡 DTO作成前のデータ確認
            print(f"cleaned_data: {cleaned_data}")

            profile_dto = UserProfileDto(
                password=cleaned_data['password'],
                # 💡 ここで引数名が合っているか確認!
                # DTOの定義に合わせて正確に引数名を指定しているか再確認してください。
                sex=cleaned_data['gender'],        
                birthday=cleaned_data['birthday'], 
                height=cleaned_data['height'],
                weight=cleaned_data['weight'], 
                device_id=cleaned_data['device_id'],
            )
            try:
                print("--- DEBUG: サービス呼び出し前 ---")
                self.user_service.complete_registration(user_id, profile_dto)
                print("--- DEBUG: 登録成功 (リダイレクトへ) ---")
                return redirect(reverse('accounts:login'))
        
            except NASException as e:
                exception_str = str(e)
                # ... (中略) ...
                if 'EMAIL_NOT_VERIFIED' in exception_str: 
                # ユーザーは登録済みなので、ログイン画面に誘導
                    print(f"--- DEBUG: EMAIL_NOT_VERIFIEDのためログインへリダイレクト ---")
                    return redirect(reverse('accounts:login')) # ログイン画面へ
                error_message = e.message
        
            except Exception as e:
                # 💡 TypeErrorなどが発生した場合、ここで捕捉される
                print(f"--- DEBUG: 予期せぬエラー: {e} ---")
                error_message = "システムエラーが発生しました。"

            # デバイスIDがあれば Device に登録
            device_id = cleaned_data.get('device_id')
            if device_id:
                
                Device.objects.create(user=user, device_id=device_id)

            
            
        else:
            print("--- DEBUG: バリデーション失敗 ---")
            print(f"form errors: {form.errors}")

        # --------------------------------------------------------
        # 💡 必須修正箇所: バリデーション失敗時、または try/except で
        # 💡 NASException以外のエラーを処理しなかった場合に到達する
        # --------------------------------------------------------
        
        # エラーメッセージをコンテキストに含める
        context = {
            'form': form,
            'user_id': user_id,
            'error_message': error_message, # サービスエラーまたはフォームエラーがあれば表示
        }
        
        return render(request, self.template_name, context)

class UserHomeView(LoginRequiredMixin, View):

    login_url = '/login/'  # ログインしていない場合のリダイレクト先
    template_name = 'accounts/user_home.html'  # ユーザーホーム画面のテンプレート名

    def get(self, request):

        """ユーザーホーム画面の表示処理"""
        return render(request, self.template_name, {'user': request.user})

class UserProfileView(LoginRequiredMixin, View):

    login_url = '/login/'  # ログインしていない場合のリダイレクト先
    template_name = 'accounts/user_info.html'  # ユーザープロフィール画面のテンプレート名

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.user_service = UserService()
    
    def get(self, request):

        """ユーザープロフィール画面の表示処理"""
        user = self.user_service.get_user_profile(request.user.pk)
        return render(request, self.template_name, {'user': user})
    
    def post(self, request):

        """プロフィール更新ボタン押下時の処理"""
        user_id = request.user.pk

        #フォームからプロフィール情報を取得
        prfile_dto = UserProfileDto(
            sex=request.POST.get('gender'),
            birthday=request.POST.get('date_of_birth'),
            height=request.POST.get('height'),
            weight=request.POST.get('weight'),
            device_id=request.POST.get('device_id'),
        )

        try:

            self.user_service.update_user_profile(user_id, prfile_dto)

            context = {
                'user': request.user,
                'success_message': 'プロフィールが更新されました。',
            }
            return render(request, self.template_name, context)
        
        except NASException as e:

            context = {
                'user': request.user,
                'error_message': e.message,
            }
            return render(request, self.template_name, context, status=400)
        return redirect(reverse('accounts:user_info'))


class LogoutView(View):

    def get(self, request):

        """ログアウト処理"""
        if request.user.is_authenticated:
            # 💡 アクセスログ記録
            LogService.log_session_end(request.user)
            
            log_action(request.user, request.user.email, "ログアウト")
        
        auth_logout(request)

        return redirect(reverse('accounts:login'))


class PreRegistrationCompleteView(View):
    """
    仮登録完了画面(メール確認待ち)を表示するビュー。
    EmailResendViewからのリダイレクト先としても利用される。
    """
    template_name = 'accounts/pre_register.html'

    def get(self, request):
        # 💡 メールアドレスなどの情報が必要な場合、セッションやGETパラメータで渡す必要がありますが、
        #    ここではシンプルに完了画面を表示します。
        return render(request, self.template_name)


# ===============================
# 共通:メールアドレス変更画面
# ===============================
class ChangeMailView(LoginRequiredMixin, View):
    template_name = 'accounts/change_mail.html'
    success_template = 'accounts/change_mail_sent.html'

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.email_change_service = EmailChangeService()

    def get(self, request):
        if isinstance(request.user, AdminUser):
            back_url = reverse('custom_admin:admin_home')
        else:
            back_url = reverse('accounts:user_home')

        return render(request, self.template_name, {
            'current_email': request.user.email,
            'back_url': back_url,
        })

    def post(self, request):
        new_email = request.POST.get('new_email', '').strip()
        password = request.POST.get('password', '').strip()

        if not new_email or not password:
            return render(request, self.template_name, {
                'error_message': 'すべての項目を入力してください。',
                'current_email': request.user.email
            })

        user = authenticate(request, email=request.user.email, password=password)
        if user is None:
            return render(request, self.template_name, {
                'error_message': 'パスワードが正しくありません。',
                'current_email': request.user.email
            })

        # ✅ 確認メール送信(request引数を追加)
        self.email_change_service.request_change(request, user, new_email)
        logout(request)
        
        return render(request, self.success_template, {
            'email': new_email
        })


# ===============================
# 共通:パスワード変更画面
# ===============================
class ChangePasswordView(LoginRequiredMixin, View):
    template_name = 'accounts/change_password.html'

    def get(self, request):

        

        if isinstance(request.user, AdminUser):
            back_url = reverse('custom_admin:admin_home')
        else:
            back_url = reverse('accounts:user_home')

        return render(request, self.template_name, {'back_url': back_url})

    def post(self, request):
        """パスワード変更処理"""
        current_password = request.POST.get('current_password', '')
        new_password = request.POST.get('new_password', '')
        confirm_password = request.POST.get('confirm_password', '')

        user = request.user

        # バリデーション
        if not user.check_password(current_password):
            return render(request, self.template_name, {'error_message': '現在のパスワードが正しくありません。'})
        if new_password != confirm_password:
            return render(request, self.template_name, {'error_message': '新しいパスワードが一致しません。'})
        if len(new_password) < 8:
            return render(request, self.template_name, {'error_message': 'パスワードは8文字以上にしてください。'})

        # 変更処理
        user.set_password(new_password)
        user.save()

        log_action(user, user.email, "パスワード変更")

        # 再ログインを求める
        auth_logout(request)
        return redirect(reverse('accounts:login'))
    
class VerifyNewEmailView(View):
    def get(self, request):
        token = request.GET.get('token')
        service = EmailChangeService()
        try:
            user = service.verify_token(token)
            return render(request, 'accounts/change_mail_complete.html', {'new_email': user.email})
        except NASException as e:
            return render(request, 'common/error.html', {'error_message': e.message})

@method_decorator(csrf_exempt, name="dispatch")
class UserProfileUpdateAPIView(LoginRequiredMixin, View):
    """
    利用者プロフィール更新API(user_info.htmlからfetchでPOSTされる)
    """
    def post(self, request):
        try:
            # リクエストJSONを読み取る
            data = json.loads(request.body)

            user_id = request.user.pk
            height = data.get("height")
            weight = data.get("weight")
            device_id = data.get("device_id")

            # バリデーション(サーバー側でも安全確認)
            if not height or not weight:
                return JsonResponse({"success": False, "message": "身長と体重は必須です。"})
            if float(height) < 30 or float(height) > 250:
                return JsonResponse({"success": False, "message": "身長の値が異常です。"})
            if float(weight) < 10 or float(weight) > 300:
                return JsonResponse({"success": False, "message": "体重の値が異常です。"})

            # DTOを作成してサービス層に渡す
            profile_dto = UserProfileDto(
                sex=getattr(request.user, "gender", None),
                birthday=getattr(request.user, "birthdate", None),
                height=height,
                weight=weight,
                device_id=device_id
            )

            UserService().update_user_profile(user_id, profile_dto)

            return JsonResponse({"success": True, "message": "プロフィールを更新しました。"})

        except NASException as e:
            return JsonResponse({"success": False, "message": e.message})
        except Exception as e:
            return JsonResponse({"success": False, "message": f"エラー: {str(e)}"})
        

class UserProfileGetAPIView(LoginRequiredMixin, View):
    """
    利用者プロフィール取得API
    フロントからの fetch('/accounts/api/get_profile/') に対応
    """
    def get(self, request):
        try:
            user_dto = UserService().get_user_profile(request.user.pk)

            # 性別を日本語に変換
            gender_display = None
            if user_dto.sex in [1, "1", "M", "男", "male", "Male"]:
                gender_display = "男"
            elif user_dto.sex in [2, "2", "F", "女", "female", "Female"]:
                gender_display = "女"

            # 生年月日を日本語フォーマットへ変換
            birthdate_display = None
            if user_dto.birthday:
                try:
                    if isinstance(user_dto.birthday, date):
                        birthdate_display = user_dto.birthday.strftime("%Y年%m月%d日")
                    else:
                        # 文字列の場合
                        birthdate_display = str(user_dto.birthday).replace("-", "年", 1).replace("-", "月", 1) + "日"
                except Exception:
                    birthdate_display = str(user_dto.birthday)

            data = {
                "email": user_dto.email,
                "height": user_dto.height,
                "weight": user_dto.weight,
                "device_id": user_dto.device_id,
                "gender": gender_display,
                "birthdate": birthdate_display,
            }
            return JsonResponse({"success": True, "data": data})
        except Exception as e:
            return JsonResponse({"success": False, "message": str(e)})
        

from django.contrib.auth.views import (
    PasswordResetView, PasswordResetDoneView,
    PasswordResetConfirmView, PasswordResetCompleteView
)

# ===============================
# パスワードリセット(ログイン不要)
# ===============================

class UserPasswordResetView(View):
    template_name = 'accounts/password_reset.html'

    def get(self, request):
        return render(request, self.template_name)

    def post(self, request):
        email = request.POST.get('email')
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return render(request, self.template_name, {
                'error_message': '該当するユーザーが存在しません。'
            })

        # トークン生成
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))

        # ✅ app-redirect を経由するURL(新規登録と同じパターン)
        base_url = request.build_absolute_uri('/').rstrip('/')
        redirect_url = f"{base_url}/accounts/app-redirect/?uid={uid}&token={token}&action=password-reset"

        # ✅ reset_url は相対パスのままでOK(MailServiceが処理)
        reset_url = reverse('accounts:password_reset_confirm', kwargs={'uidb64': uid, 'token': token})

        # ✅ MailServiceに渡す
        MailService.send_password_reset_email(
            user=user,
            reset_url=reset_url,  # 相対パス
            request=request
        )

        return render(request, 'accounts/password_reset_done.html', {'email': email})

class UserPasswordResetDoneView(PasswordResetDoneView):
    """送信完了画面"""
    template_name = 'accounts/password_reset_done.html'


class UserPasswordResetConfirmView(PasswordResetConfirmView):
    """メールリンクからのパスワード再設定画面"""
    template_name = 'accounts/password_reset_confirm.html'
    success_url = reverse_lazy('accounts:password_reset_complete')


class UserPasswordResetCompleteView(PasswordResetCompleteView):
    """再設定完了画面"""
    template_name = 'accounts/password_reset_complete.html'


class AppRedirectView(View):
    """
    メールからアプリへのリダイレクト用ページ
    """
    def get(self, request):
        token = request.GET.get('token', '')
        uid = request.GET.get('uid', '')
        action = request.GET.get('action', 'verify-email')
        
        # ✅ デバッグログ追加
        print("=" * 60)
        print("📥 AppRedirectView 呼び出し")
        print(f"🔑 token: {token}")
        print(f"🔑 uid: {uid}")
        print(f"⚙️ action: {action}")
        print("=" * 60)
        
        # アプリ用URL生成
        if action == 'verify-email' or not action:
            # ✅ verify に修正(complete-registration ではない)
            app_url = f'nasapp://verify?token={token}'
            web_url = f'/accounts/verify/?token={token}'
            
        elif action == 'password-reset':
            app_url = f'nasapp://password-reset-confirm?uid={uid}&token={token}'
            web_url = f'/accounts/password-reset-confirm/{uid}/{token}/'
            
        elif action == 'email-change':
            app_url = f'nasapp://verify-new-email?token={token}'
            web_url = f'/accounts/verify-new-email/?token={token}'
            
        else:
            app_url = 'nasapp://'
            web_url = '/'
        
        print(f"🔗 生成されたapp_url: {app_url}")
        print(f"🔗 生成されたweb_url: {web_url}")
        
        context = {
            'app_url': app_url,
            'web_url': web_url,
            'action': action,
        }
        return render(request, 'accounts/app_redirect.html', context)
    

class EmailVerificationAPIView(APIView):
    """
    アプリ用メール認証API
    GET /accounts/api/verify-email/?token=xxx
    """
    permission_classes = [AllowAny]
    
    def get(self, request):
        token = request.GET.get('token', '')
        
        # ✅ デバッグログ追加
        print(f"📥 メール認証API呼び出し")
        print(f"🔑 token={token}")
        print(f"📍 request.GET={request.GET}")
        
        if not token:
            print("❌ トークンなし")
            return Response(
                {'success': False, 'error': 'トークンが指定されていません'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            print("🔄 AuthService呼び出し開始")
            auth_service = AuthService()
            user, temp_token = auth_service.verify_and_activate_user(token)
            
            print(f"✅ メール認証成功: user_id={user.pk}, email={user.email}")
            print(f"🔑 temp_token keys: {temp_token.keys()}")
            
            return Response({
                'success': True,
                'user_id': str(user.pk),
                'email': user.email,
                'access_token': temp_token['access'],
                'refresh_token': temp_token['refresh'],
                'message': 'メール認証が完了しました'
            })
            
        except NASException as e:
            print(f"❌ NASException: {e.message}")
            print(f"❌ Exception code: {e.code if hasattr(e, 'code') else 'なし'}")
            return Response(
                {'success': False, 'error': e.message},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            print(f"❌ 予期せぬエラー: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response(
                {'success': False, 'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )