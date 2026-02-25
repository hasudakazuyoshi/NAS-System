# api/auth/views.py

# 🔥 インポート部分
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str

from accounts.models import User, Device
from accounts.service import AuthService, UserService
from common.exceptions import NASException
from common.dtos import PreRegistrationDto, UserProfileDto
from system_log.services import LogService  # 💡 追加
from django.contrib.contenttypes.models import ContentType
from accounts.models import PendingEmailChange

from .serializers import (
    UserSerializer,
    ProvisionalRegistrationSerializer,
    UserUpdateSerializer,
    PasswordChangeSerializer,
    DeviceSerializer,
    DeviceRegisterSerializer,
    EmailVerificationSerializer,
    CompleteRegistrationSerializer,
    EmailChangeRequestSerializer,
    EmailChangeResponseSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetResponseSerializer,
    PasswordResetTokenVerifySerializer,
    PasswordResetByUserIdSerializer,
)


# ==========================================================
# 🔥 仮登録(accounts.serviceを使用)
# ==========================================================
class PreRegistrationAPIView(APIView):
    """仮登録API - メールアドレスのみで仮登録"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        print("📥 受信データ:", request.data)
        print("📥 Content-Type:", request.content_type)
        
        serializer = ProvisionalRegistrationSerializer(data=request.data)
        
        if not serializer.is_valid():
            print("❌ バリデーションエラー:", serializer.errors)
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            email = serializer.validated_data['email']
            print("✅ バリデーション成功 - Email:", email)
            
            dto = PreRegistrationDto(email=email)
            
            auth_service = AuthService()
            token_uuid = auth_service.register_pre_user(dto)
            
            print("✅ トークン生成成功:", token_uuid)
            
            return Response({
                'message': '仮登録メールを送信しました',
                'email': email,
                'success': True
            }, status=status.HTTP_201_CREATED)
            
        except NASException as e:
            print("❌ NASException:", str(e))
            return Response({
                'error': str(e),
                'success': False
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print("❌ 予期せぬエラー:", str(e))
            import traceback
            traceback.print_exc()
            return Response({
                'error': str(e),
                'success': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==========================================================
# 🔥 メール確認 & 一時トークン発行(accounts.serviceを使用)
# ==========================================================
class EmailVerificationAPIView(APIView):
    """メール確認 & 一時トークン発行API"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        token = request.GET.get('token', '')
        
        print(f"📥 メール認証API呼び出し (GET)")
        print(f"🔑 token={token}")
        
        if not token:
            print("❌ トークンなし")
            return Response({
                'error': 'トークンが指定されていません',
                'success': False
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            print("🔄 AuthService呼び出し開始")
            auth_service = AuthService()
            user, temp_token = auth_service.verify_and_activate_user(token)
            
            print(f"✅ メール認証成功: user_id={user.pk}, email={user.email}")
            
            return Response({
                'message': 'メール認証が完了しました',
                'user_id': str(user.user_id),
                'email': user.email,
                'access_token': temp_token['access'],
                'refresh_token': temp_token['refresh'],
                'is_active': user.is_active,
                'success': True
            }, status=status.HTTP_200_OK)
            
        except NASException as e:
            print(f"❌ NASException: {e.message}")
            return Response({
                'error': e.message,
                'success': False
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"❌ 予期せぬエラー: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': str(e),
                'success': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        serializer = EmailVerificationSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            token = str(serializer.validated_data['token'])
            
            auth_service = AuthService()
            user, temp_token = auth_service.verify_and_activate_user(token)
            
            return Response({
                'message': '仮登録が完了しました',
                'user_id': user.user_id,
                'email': user.email,
                'temp_token': temp_token,
                'is_active': user.is_active,
                'success': True
            }, status=status.HTTP_200_OK)
            
        except NASException as e:
            return Response({
                'error': str(e),
                'success': False
            }, status=status.HTTP_400_BAD_REQUEST)


# ==========================================================
# 🔥 本登録完了(accounts.serviceを使用)
# ==========================================================
class CompleteRegistrationAPIView(APIView):
    """本登録完了API - パスワードや性別などの詳細情報を登録"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        print(f"📥 本登録API呼び出し")
        print(f"🔑 Authorization Header: {request.headers.get('Authorization', 'なし')[:50]}")
        print(f"🔍 認証済みユーザー: {request.user}")
        print(f"📋 受信データ: {request.data}")
        
        serializer = CompleteRegistrationSerializer(data=request.data)
        
        if not serializer.is_valid():
            print(f"❌ バリデーションエラー: {serializer.errors}")
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            data = serializer.validated_data
            
            user_id = request.user.user_id if hasattr(request.user, 'user_id') else request.user.pk
            user_email = request.user.email
            
            print(f"✅ 使用するユーザーID: {user_id}")
            print(f"✅ 使用するEmail: {user_email}")
            
            profile_dto = UserProfileDto(
                email=user_email,
                password=data['password'],
                sex=data['gender'],
                birthday=data['birthday'],
                height=data.get('height'),
                weight=data.get('weight'),
                device_id=data.get('device_id'),
            )
            
            user_service = UserService()
            user, official_token = user_service.complete_registration(
                user_id,
                profile_dto
            )
            
            return Response({
                'message': '本登録が完了しました',
                'user_id': user.user_id,
                'email': user.email,
                'token': official_token,
                'success': True
            }, status=status.HTTP_200_OK)
            
        except NASException as e:
            print(f"❌ NASException: {e.message}")
            return Response({
                'error': e.message,
                'success': False
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"❌ 予期せぬエラー: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': str(e),
                'success': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==========================================================
# ログインAPI (JWTトークン取得)
# ==========================================================
class UserLoginView(APIView):
    """ログインしてJWTトークンを取得"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response(
                {'error': 'メールアドレスとパスワードを入力してください'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'メールアドレスまたはパスワードが正しくありません'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.check_password(password):
            return Response(
                {'error': 'メールアドレスまたはパスワードが正しくありません'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.is_active:
            return Response(
                {'error': 'このアカウントは無効化されています'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # 💡 アクセスログ記録
        LogService.log_session_start(user)

        # JWT トークン生成
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })


# ==========================================================
# ログアウトAPI
# ==========================================================
class UserLogoutView(APIView):
    """ログアウト"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            # 💡 アクセスログ記録
            LogService.log_session_end(request.user)
            
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
            
            return Response({
                'message': 'ログアウトしました'
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'message': 'ログアウトしました'
            }, status=status.HTTP_200_OK)


# ==========================================================
# 認証ユーザー自身の情報取得・更新
# ==========================================================
class UserMeView(APIView):
    """認証済みユーザーの情報取得・更新"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """ユーザー情報取得"""
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        """ユーザー情報更新"""
        serializer = UserUpdateSerializer(
            request.user,
            data=request.data,
            partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


# ==========================================================
# パスワード変更
# ==========================================================
class PasswordChangeView(APIView):
    """パスワード変更API"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        
        return Response({
            'message': 'パスワードを変更しました'
        })


# ==========================================================
# デバイス関連
# ==========================================================
class DeviceRegisterView(APIView):
    """デバイス登録API"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = DeviceRegisterSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        device = serializer.save()
        
        return Response(
            DeviceSerializer(device).data,
            status=status.HTTP_201_CREATED
        )


class DeviceListView(generics.ListAPIView):
    """ユーザーのデバイス一覧取得"""
    serializer_class = DeviceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Device.objects.filter(user=self.request.user)


class DeviceDeleteView(generics.DestroyAPIView):
    """デバイス削除"""
    serializer_class = DeviceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Device.objects.filter(user=self.request.user)


# ==========================================================
# アカウント削除(退会)
# ==========================================================
class UserDeleteView(APIView):
    """アカウント削除(退会)API"""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request):
        try:
            user = request.user
            user_email = user.email
            user_id = user.user_id
            
            # ✅ 退会前に PendingEmailChange をクリーンアップ
            user_content_type = ContentType.objects.get_for_model(User)
            PendingEmailChange.objects.filter(
                content_type=user_content_type,
                object_id=str(user_id)
            ).delete()
            
            # 物理削除
            user.delete()
            
            return Response({
                'message': f'アカウント {user_email} (ID: {user_id}) を削除しました',
                'success': True
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({
                'error': f'退会処理に失敗しました: {str(e)}',
                'success': False
            }, status=status.HTTP_400_BAD_REQUEST)


# ==========================================================
# 🔥 パスワードリセット(リクエスト)
# ==========================================================
class PasswordResetRequestAPIView(APIView):
    """パスワードリセットメール送信API"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        
        if not serializer.is_valid():
            print('❌ バリデーションエラー:', serializer.errors)
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        email = serializer.validated_data['email']
        
        print('📥 パスワードリセットリクエスト')
        print('📧 メールアドレス:', email)

        try:
            user = User.objects.get(email=email)
            print(f'✅ ユーザー発見: {user.user_id}')
        except User.DoesNotExist:
            # 🔥 セキュリティのため、ユーザーが存在しない場合も成功レスポンスを返す
            print('⚠️ ユーザーが存在しません(セキュリティのため成功レスポンス)')
            response_serializer = PasswordResetResponseSerializer({
                'success': True,
                'message': 'パスワードリセットメールを送信しました'
            })
            return Response(response_serializer.data, status=status.HTTP_200_OK)

        # トークン生成
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        
        print(f'🔑 トークン生成: uid={uid[:20]}..., token={token[:20]}...')
        
        # メール送信
        from mail.services import MailService
        
        # リダイレクトURL生成
        base_url = request.build_absolute_uri('/').rstrip('/')
        redirect_url = f"{base_url}/accounts/app-redirect/?uid={uid}&token={token}&action=password-reset"
        
        print(f'📧 メール送信URL: {redirect_url}')
        
        MailService.send_password_reset_email(
            user=user,
            reset_url=redirect_url,
            request=request,
            web_url=redirect_url,
        )
        
        print('✅ パスワードリセットメール送信完了')

        response_serializer = PasswordResetResponseSerializer({
            'success': True,
            'message': 'パスワードリセットメールを送信しました'
        })
        return Response(response_serializer.data, status=status.HTTP_200_OK)


# ==========================================================
# 🔥 パスワードリセット(確認・実行)
# ==========================================================
class PasswordResetConfirmAPIView(APIView):
    """パスワードリセット実行API"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        
        if not serializer.is_valid():
            print('❌ バリデーションエラー:', serializer.errors)
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']

        print('📥 パスワードリセット確認')
        print(f'🔑 uid: {uid[:20]}...')
        print(f'🔑 token: {token[:20]}...')

        try:
            # UIDをデコード
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
            print(f'✅ ユーザー発見: {user.user_id}')
        except (TypeError, ValueError, OverflowError, User.DoesNotExist) as e:
            print(f'❌ ユーザー取得エラー: {e}')
            return Response(
                {'error': '無効なリセットリンクです'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # トークン検証
        if not default_token_generator.check_token(user, token):
            print('❌ トークンが無効または期限切れ')
            return Response(
                {'error': 'リセットリンクの有効期限が切れています'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # パスワード変更
        user.set_password(new_password)
        user.save()
        
        print('✅ パスワード変更完了')

        response_serializer = PasswordResetResponseSerializer({
            'success': True,
            'message': 'パスワードを変更しました'
        })
        return Response(response_serializer.data, status=status.HTTP_200_OK)


# ==========================================================
# 🔥 メールアドレス変更(リクエスト)
# ==========================================================
class EmailChangeRequestAPIView(APIView):
    """メールアドレス変更リクエストAPI"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = EmailChangeRequestSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if not serializer.is_valid():
            print('❌ バリデーションエラー:', serializer.errors)
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        new_email = serializer.validated_data['new_email']
        password = serializer.validated_data['password']
        
        print('📥 メールアドレス変更リクエスト')
        print(f'👤 現在のユーザー: {request.user.email}')
        print(f'📧 新しいメールアドレス: {new_email}')

        # パスワード確認
        if not request.user.check_password(password):
            print('❌ パスワードが正しくありません')
            return Response(
                {'error': 'パスワードが正しくありません'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # EmailChangeServiceを使用
            from accounts.service import EmailChangeService
            
            email_change_service = EmailChangeService()
            pending = email_change_service.request_change(request, request.user, new_email)
            
            print(f'✅ メールアドレス変更確認メール送信完了: token={pending.token}')

            response_serializer = EmailChangeResponseSerializer({
                'success': True,
                'message': '確認メールを送信しました。新しいメールアドレスのメールボックスを確認してください。'
            })
            return Response(response_serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            print(f'❌ メールアドレス変更エラー: {e}')
            import traceback
            traceback.print_exc()
            return Response({
                'error': str(e),
                'success': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# ==========================================================
# 🔥 メールアドレス変更(確認・実行)
# ==========================================================
class EmailChangeConfirmAPIView(APIView):
    """メールアドレス変更確認API"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        """GET /api/auth/email/change/confirm/?token=xxx"""
        token = request.GET.get('token')
        
        print('📥 メールアドレス変更確認 (GET)')
        print(f'🔑 token: {token[:20] if token else None}...')
        
        if not token:
            return Response(
                {'success': False, 'error': 'トークンが指定されていません'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from accounts.service import EmailChangeService
            
            email_change_service = EmailChangeService()
            user = email_change_service.verify_token(token)
            
            print(f'✅ メールアドレス変更完了: {user.email}')

            return Response({
                'success': True,
                'message': 'メールアドレスを変更しました',
                'new_email': user.email
            }, status=status.HTTP_200_OK)
            
        except NASException as e:
            print(f'❌ NASException: {e.message}')
            return Response({
                'success': False,
                'error': e.message
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f'❌ メールアドレス変更確認エラー: {e}')
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def post(self, request):
        """POST /api/auth/email/change/confirm/"""
        token = request.data.get('token')
        
        print('📥 メールアドレス変更確認 (POST)')
        print(f'🔑 token: {token[:20] if token else None}...')
        
        if not token:
            return Response(
                {'success': False, 'error': 'トークンが指定されていません'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            from accounts.service import EmailChangeService
            
            email_change_service = EmailChangeService()
            user = email_change_service.verify_token(token)
            
            print(f'✅ メールアドレス変更完了: {user.email}')

            return Response({
                'success': True,
                'message': 'メールアドレスを変更しました',
                'new_email': user.email
            }, status=status.HTTP_200_OK)
            
        except NASException as e:
            print(f'❌ NASException: {e.message}')
            return Response({
                'success': False,
                'error': e.message
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f'❌ メールアドレス変更確認エラー: {e}')
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

# ==========================================================
# 🔥 パスワードリセット（新規登録方式）
# ==========================================================

class PasswordResetTokenVerifyAPIView(APIView):
    """
    パスワードリセットトークン検証API（新規登録方式）
    Django側でトークンを検証し、成功したらuser_idだけ返す
    
    POST /api/auth/password-reset-token-verify/
    Body: { "uid": "...", "token": "..." }
    Response: { "valid": true, "user_id": "NU00001", "email": "xxx@xxx" }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetTokenVerifySerializer(data=request.data)
        
        if not serializer.is_valid():
            print('❌ バリデーションエラー:', serializer.errors)
            return Response({
                'valid': False,
                'error': 'uid/tokenが必要です'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        
        print('🔍 パスワードリセットトークン検証')
        print(f'   uid: {uid}')
        print(f'   token: {token[:20]}...')

        try:
            # UIDをデコード
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
            
            print(f'✅ ユーザー発見: {user.user_id}')
            
            # トークン検証
            if default_token_generator.check_token(user, token):
                print('✅ トークン有効')
                return Response({
                    'valid': True,
                    'user_id': user.user_id,
                    'email': user.email
                }, status=status.HTTP_200_OK)
            else:
                print('❌ トークン無効')
                return Response({
                    'valid': False,
                    'error': 'トークンが無効または期限切れです'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        except (TypeError, ValueError, OverflowError, User.DoesNotExist) as e:
            print(f'❌ トークン検証エラー: {e}')
            return Response({
                'valid': False,
                'error': '無効なリセットリンクです'
            }, status=status.HTTP_400_BAD_REQUEST)


class PasswordResetByUserIdAPIView(APIView):
    """
    user_idでパスワードリセットAPI（トークン検証済み前提）
    
    POST /api/auth/password-reset-by-userid/
    Body: { "user_id": "NU00001", "new_password": "..." }
    Response: { "success": true, "message": "..." }
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetByUserIdSerializer(data=request.data)
        
        if not serializer.is_valid():
            print('❌ バリデーションエラー:', serializer.errors)
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user_id = serializer.validated_data['user_id']
        new_password = serializer.validated_data['new_password']
        
        print('📥 パスワードリセット実行')
        print(f'👤 user_id: {user_id}')

        try:
            user = User.objects.get(user_id=user_id)
            user.set_password(new_password)
            user.save()
            
            print(f'✅ パスワード更新成功: {user_id}')
            
            return Response({
                'success': True,
                'message': 'パスワードを変更しました'
            }, status=status.HTTP_200_OK)
        
        except User.DoesNotExist:
            print(f'❌ ユーザーが見つかりません: {user_id}')
            return Response({
                'success': False,
                'error': 'ユーザーが見つかりません'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            print(f'❌ パスワード更新エラー: {e}')
            import traceback
            traceback.print_exc()
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)