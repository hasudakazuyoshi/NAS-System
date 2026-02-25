from django.contrib.auth.hashers import make_password, check_password
from django.db import transaction
from django.utils import timezone
import uuid

from common.exceptions import NASException
from common.dtos import UserRegistrationDto, UserProfileDto, PreRegistrationDto
from accounts.models import User, VerificationToken, PendingEmailChange, PreRegistration, Device
from accounts.repositories import UserRepository, VerificationTokenRepository
from mail.services import MailService
from django.contrib.contenttypes.models import ContentType
from django.urls import reverse
from rest_framework_simplejwt.tokens import RefreshToken
from django.conf import settings


# ==========================================================
# 認証系サービス（仮登録・本登録・ログイン）
# ==========================================================
class AuthService:
    def __init__(self):
        self.user_repository = UserRepository()
        self.token_repository = VerificationTokenRepository()
        self.mail_service = MailService()

    @transaction.atomic
    def register_pre_user(self, registration_dto) -> str:
        """仮登録 - メールアドレスのみで仮登録（再送対応版）"""
        email = registration_dto.email

        # 1. すでに本登録（プロフィール入力まで）完了しているかチェック
        # ここでいう「本登録完了」は、パスワード設定やプロフィール設定が終わっている状態を指すべきです
        user = User.objects.filter(email=email).first()
        if user and user.email_verified and user.has_usable_password(): 
            # 既にパスワードも設定済みの「完全なユーザー」ならエラー
            raise NASException('USER_ALREADY_EXISTS', 'そのメールアドレスは既に登録されています。ログインしてください。')

        # ✅ 2. 本登録未完了ユーザーが存在する場合は削除
        # メール認証済みだが本登録（身長・体重入力）をしていないユーザーを削除
        deleted_count, _ = User.objects.filter(
            email=email,
            is_staff=False,
            height=0,
            weight=0,
        ).delete()
        if deleted_count > 0:
            print(f"🗑️ 本登録未完了ユーザー削除: {email} ({deleted_count}件)")

        # ✅ 3. 既存の仮登録(PreRegistration)とそれに関連するトークンを削除（クリーンスタート）
        # これにより、Web版でも「2回目」を叩いた時に古いトークンが無効化され、新しくなります
        PreRegistration.objects.filter(email=email).delete()
        
        # ✅ 4. 新しい仮登録を作成
        pre_registration = PreRegistration.objects.create(
            email=email,
            token=uuid.uuid4(),
            created_at=timezone.now(),
            expires_at=timezone.now() + timezone.timedelta(hours=24),
            is_used=False,
        )
        
        # ✅ 5. VerificationTokenを作成
        token_uuid = uuid.uuid4()
        VerificationToken.objects.create(
            token=token_uuid,
            token_type='REGISTRATION',
            expires_at=timezone.now() + timezone.timedelta(hours=24),
            pre_registration=pre_registration,
        )
        
        # 6. メール送信
        self.mail_service.send_verification_email(email, str(token_uuid))
        
        print(f"✅ 再送/新規作成完了: {email} にトークン {token_uuid} を送信しました")
        
        return str(token_uuid)

    @transaction.atomic
    def verify_and_activate_user(self, token: str):
        """メール認証 & 仮ユーザー作成（冪等性保証）"""
        
        print(f"🔍 トークン検証開始: {token}")
        
        try:
            verification_token = VerificationToken.objects.get(
                token=token,
                token_type='REGISTRATION'
            )
            print(f"✅ VerificationToken発見")
        except VerificationToken.DoesNotExist:
            print(f"❌ VerificationTokenが見つかりません")
            raise NASException('TOKEN_NOT_FOUND', '無効な確認URLです。')

        if verification_token.is_expired():
            print(f"❌ トークン期限切れ")
            raise NASException('TOKEN_EXPIRED', '確認URLの有効期限が切れています。')

        pre = verification_token.pre_registration
        if pre is None:
            print(f"❌ PreRegistration が見つかりません")
            raise NASException('PRE_REGISTRATION_NOT_FOUND', '仮登録情報が見つかりません。')

        if pre.is_used:
            print(f"⚠️ 既に使用済みのトークン - 既存ユーザーを返します")
            existing_user = User.objects.filter(email=pre.email).first()
            if existing_user:
                temp_token = self._generate_temp_token(existing_user)
                print(f"✅ 既存ユーザー返却: {existing_user.user_id}")
                return existing_user, temp_token
            else:
                raise NASException('USER_NOT_FOUND', 'ユーザーが見つかりません')

        print(f"✅ PreRegistration発見: {pre.email}")

        existing_user = User.objects.filter(email=pre.email).first()
        if existing_user:
            if not existing_user.email_verified:
                print(f"⚠️ 既存の未完了ユーザーを再利用: {existing_user.user_id}")
                # email_verifiedはFalseのまま（ここでは変更しない）
                pre.is_used = True
                pre.save()
                
                temp_token = self._generate_temp_token(existing_user)
                return existing_user, temp_token
            else:
                print(f"❌ 既に本登録済み")
                pre.is_used = True
                pre.save()
                raise NASException('USER_ALREADY_ACTIVE', 'このメールアドレスは既に本登録が完了しています。')

        # ✅ 新規Userを作成（is_active=True, email_verified=False）
        provisional_password = uuid.uuid4().hex

        user = User.objects.create(
            email=pre.email,
            password=make_password(provisional_password),
            is_active=True,  # ← ログイン可能に
            email_verified=False  # ← 本登録完了まではFalse（ここを変更）
        )

        print(f"✅ 仮ユーザー作成: {user.user_id} (is_active={user.is_active}, email_verified={user.email_verified})")

        pre.is_used = True
        pre.save()

        temp_token = self._generate_temp_token(user)
        
        print(f"✅ 一時トークン発行完了")
        
        return user, temp_token

    def _generate_temp_token(self, user):
        """一時的なJWTトークンを発行"""
        refresh = RefreshToken.for_user(user)
        
        # カスタムクレーム
        refresh['is_temporary'] = True
        refresh['needs_profile_completion'] = not user.email_verified  # ← 変更
        
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }

    def authenticate_user(self, email: str, password: str):
        """ログイン認証"""
        user = self.user_repository.get_user_by_email(email)

        if user is None or not check_password(password, user.password):
            raise NASException('AUTHENTICATION_FAILED', 'メールアドレスまたはパスワードが正しくありません。')

        if not user.is_active:
            raise NASException('ACCOUNT_NOT_ACTIVE', 'アカウントが無効です。')
        
        # メール認証チェック（必要に応じて）
        # if not user.email_verified:
        #     raise NASException('EMAIL_NOT_VERIFIED', 'メール認証が完了していません。')

        return user


# ==========================================================
# ユーザーのプロフィール関連
# ==========================================================
class UserService:
    
    @transaction.atomic
    def complete_registration(self, user_id, profile_dto: UserProfileDto):
        """本登録完了 & 正式トークン発行"""
        
        print(f"📝 本登録開始: user_id={user_id}")
        
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            print(f"❌ ユーザーが見つかりません: {user_id}")
            raise NASException("USER_NOT_FOUND", f"ユーザーID {user_id} が見つかりません。")

        # ✅ チェックを削除（email_verifiedの判定なし）

        # ✅ ユーザー情報を更新
        user.gender = profile_dto.sex
        user.birthdate = profile_dto.birthday
        user.height = profile_dto.height if profile_dto.height else 0
        user.weight = profile_dto.weight if profile_dto.weight else 0

        if profile_dto.password:
            user.set_password(profile_dto.password)

        user.email_verified = True  # ← 本登録完了時にTrueにする
        user.save()
        
        print(f"✅ ユーザー情報更新完了 (email_verified={user.email_verified})")

        # デバイス登録（任意）
        if hasattr(profile_dto, 'device_id') and profile_dto.device_id:
            Device.objects.create(user=user, device_id=profile_dto.device_id)
            print(f"✅ デバイス登録完了: {profile_dto.device_id}")

        # ✅ 正式なトークンを発行
        official_token = self._generate_official_token(user)
        
        print(f"✅ 本登録完了")
        
        return user, official_token

    def _generate_official_token(self, user):
        """正式なJWTトークンを発行"""
        refresh = RefreshToken.for_user(user)
        
        return {
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }

    def get_user_profile(self, user_id):
        """ユーザープロフィール取得"""
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            raise NASException("USER_NOT_FOUND", f"ユーザーID {user_id} が見つかりません。")

        device = Device.objects.filter(user_id=user_id).order_by('-created_at').first()
        device_id = device.device_id if device else None

        return UserProfileDto(
            email=user.email,
            sex=user.gender,
            birthday=user.birthdate,
            height=user.height,
            weight=user.weight,
            device_id=device_id
        )


# ==========================================================
# メールアドレス変更
# ==========================================================
class EmailChangeService:

    def __init__(self):
        self.mail_service = MailService()

    def request_change(self, request, user, new_email):
        """メールアドレス変更リクエスト"""
        # ✅ 本登録未完了ユーザーが存在する場合は削除
        deleted_count, _ = User.objects.filter(
            email=new_email,
            is_staff=False,
            height=0,
            weight=0,
        ).delete()
        if deleted_count > 0:
            print(f"🗑️ 本登録未完了ユーザー削除（メール変更）: {new_email} ({deleted_count}件)")
        
        content_type = ContentType.objects.get_for_model(user.__class__)
        token = uuid.uuid4()

        PendingEmailChange.objects.filter(new_email=new_email).delete()
        PendingEmailChange.objects.filter(
            content_type=content_type, object_id=str(user.pk)
        ).delete()

        pending = PendingEmailChange.objects.create(
            content_type=content_type,
            object_id=str(user.pk),
            new_email=new_email,
            token=token
        )

        # ✅ app-redirect を経由するように変更（新規登録と統一）
        base_url = request.build_absolute_uri('/').rstrip('/')
        # web_url と app_url は不要（MailService側で生成）
        
        self.mail_service.send_email_change_verification(
            recipient_email=new_email,
            token=str(token),
            request=request  # requestだけ渡す
        )
        
        return pending

    def resend_change_email(self, request, email):
        """メールアドレス変更確認メールの再送信"""
        pending = PendingEmailChange.objects.filter(new_email=email, is_verified=False).first()
        
        if not pending:
            raise NASException("PENDING_NOT_FOUND", "該当する変更申請が見つかりません。")
        
        # ✅ app-redirect を経由するように変更
        self.mail_service.send_email_change_verification(
            recipient_email=email,
            token=str(pending.token),
            request=request  # requestだけ渡す
        )
        
        return pending

    @transaction.atomic
    def verify_token(self, token):
        """メールアドレス変更トークン検証"""
        pending = PendingEmailChange.objects.filter(token=token, is_verified=False).first()

        if not pending:
            raise NASException("INVALID_TOKEN", "無効な確認リンクです。")

        if pending.is_expired():
            raise NASException("TOKEN_EXPIRED", "確認リンクの有効期限が切れています。")

        user = pending.user
        user.email = pending.new_email
        user.save()

        pending.is_verified = True
        pending.save()

        return user