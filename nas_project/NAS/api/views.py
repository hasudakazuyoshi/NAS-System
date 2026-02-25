from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from accounts.models import User, Device
from .serializers import (
    UserSerializer,
    UserRegistrationSerializer,
    UserUpdateSerializer,
    PasswordChangeSerializer,
    DeviceSerializer,
    DeviceRegisterSerializer,
)


# ==========================================================
# ユーザー登録
# ==========================================================
class UserRegisterView(generics.CreateAPIView):
    """新規ユーザー登録API"""
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # JWT トークン生成
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


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
    """ログアウト (リフレッシュトークンをブラックリスト化)"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if not refresh_token:
                return Response(
                    {'error': 'リフレッシュトークンが必要です'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            token = RefreshToken(refresh_token)
            token.blacklist()

            return Response({'message': 'ログアウトしました'})
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


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