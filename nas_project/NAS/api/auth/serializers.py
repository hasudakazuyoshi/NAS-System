from rest_framework import serializers
from accounts.models import User, Device
from django.contrib.auth.password_validation import validate_password


class UserSerializer(serializers.ModelSerializer):
    """ユーザー情報のシリアライザー"""
    device_id = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = [
            "user_id", 
            "email",
            "email_verified",
            "height", 
            "weight", 
            "gender", 
            "birthdate",
            "date_joined",
            "is_active",
            "device_id",
        ]
        read_only_fields = ["user_id", "email", "date_joined", "is_active", "device_id"]
    
    def get_device_id(self, obj):
        """最新のデバイスIDを取得"""
        device = obj.devices.order_by('-created_at').first()
        return device.device_id if device else None


class ProvisionalRegistrationSerializer(serializers.Serializer):
    """仮登録用シリアライザー（メールアドレスのみ）"""
    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        """メールアドレスの重複チェック"""
        if User.objects.filter(email=value, email_verified=True).exists():
            raise serializers.ValidationError("このメールアドレスは既に本登録が完了しています。ログインしてください。")
        return value


class UserUpdateSerializer(serializers.ModelSerializer):
    """ユーザー情報更新用シリアライザー"""
    class Meta:
        model = User
        fields = ["height", "weight", "gender", "birthdate"]


class PasswordChangeSerializer(serializers.Serializer):
    """パスワード変更用シリアライザー"""
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        validators=[validate_password]
    )
    new_password_confirm = serializers.CharField(required=True, write_only=True)

    def validate_old_password(self, value):
        """現在のパスワードが正しいかチェック"""
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("現在のパスワードが正しくありません")
        return value

    def validate(self, attrs):
        """新しいパスワードの確認"""
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError({
                "new_password": "パスワードが一致しません"
            })
        return attrs

    def save(self, **kwargs):
        """パスワード更新"""
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class DeviceSerializer(serializers.ModelSerializer):
    """デバイス情報のシリアライザー"""
    user_email = serializers.EmailField(source='user.email', read_only=True)
    
    class Meta:
        model = Device
        fields = ["id", "device_id", "user", "user_email", "created_at"]
        read_only_fields = ["id", "created_at", "user"]


class DeviceRegisterSerializer(serializers.Serializer):
    """デバイス登録用シリアライザー"""
    device_id = serializers.CharField(max_length=50, required=True)

    def validate_device_id(self, value):
        """デバイスIDの形式チェック"""
        if not value or len(value) < 3:
            raise serializers.ValidationError("デバイスIDが無効です")
        return value

    def create(self, validated_data):
        """デバイス登録または更新"""
        user = self.context['request'].user
        device, created = Device.objects.update_or_create(
            device_id=validated_data['device_id'],
            defaults={'user': user}
        )
        return device
    

class EmailVerificationSerializer(serializers.Serializer):
    """メール確認用（トークンを受け取る）"""
    token = serializers.UUIDField()


class CompleteRegistrationSerializer(serializers.Serializer):
    """本登録完了用"""
    password = serializers.CharField(
        min_length=8, 
        write_only=True,
        validators=[validate_password]
    )
    password_confirm = serializers.CharField(
        min_length=8,
        write_only=True
    )
    gender = serializers.ChoiceField(choices=['male', 'female'])
    birthday = serializers.DateField()
    height = serializers.DecimalField(
        max_digits=5, 
        decimal_places=1, 
        required=False,
        allow_null=True
    )
    weight = serializers.DecimalField(
        max_digits=5, 
        decimal_places=1, 
        required=False,
        allow_null=True
    )
    device_id = serializers.CharField(
        max_length=50, 
        required=False, 
        allow_blank=True,
        allow_null=True
    )
    
    def validate(self, attrs):
        """パスワード確認"""
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({
                "password": "パスワードが一致しません"
            })
        return attrs


# ==================== メールアドレス変更関連 ====================

class EmailChangeRequestSerializer(serializers.Serializer):
    """メールアドレス変更リクエスト用シリアライザー"""
    new_email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)
    
    def validate_new_email(self, value):
        """新しいメールアドレスのバリデーション"""
        if not value.strip():
            raise serializers.ValidationError("メールアドレスを入力してください")
        
        # メールアドレスの重複チェック
        request = self.context.get('request')
        if request and request.user:
            if User.objects.filter(email=value).exclude(pk=request.user.pk).exists():
                raise serializers.ValidationError("このメールアドレスは既に使用されています")
        
        return value.strip()
    
    def validate_password(self, value):
        """パスワードのバリデーション"""
        if not value:
            raise serializers.ValidationError("パスワードを入力してください")
        if len(value) < 8:
            raise serializers.ValidationError("パスワードは8文字以上で入力してください")
        return value


class EmailChangeResponseSerializer(serializers.Serializer):
    """メールアドレス変更レスポンス用シリアライザー"""
    success = serializers.BooleanField()
    message = serializers.CharField()


# ==================== パスワードリセット関連 ====================

class PasswordResetRequestSerializer(serializers.Serializer):
    """パスワードリセットリクエスト用シリアライザー"""
    email = serializers.EmailField()
    
    def validate_email(self, value):
        """メールアドレスのバリデーション"""
        if not value.strip():
            raise serializers.ValidationError("メールアドレスを入力してください")
        
        # ユーザーの存在チェック
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("このメールアドレスは登録されていません")
        
        return value.strip()


class PasswordResetConfirmSerializer(serializers.Serializer):
    """パスワードリセット確認用シリアライザー"""
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(
        write_only=True, 
        min_length=8,
        validators=[validate_password]
    )
    confirm_password = serializers.CharField(write_only=True, min_length=8)
    
    def validate_new_password(self, value):
        """新しいパスワードのバリデーション"""
        if not value:
            raise serializers.ValidationError("パスワードを入力してください")
        if len(value) < 8:
            raise serializers.ValidationError("パスワードは8文字以上で入力してください")
        return value
    
    def validate(self, data):
        """パスワード一致チェック"""
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({
                'confirm_password': '新しいパスワードが一致しません'
            })
        return data


class PasswordResetResponseSerializer(serializers.Serializer):
    """パスワードリセットレスポンス用シリアライザー"""
    success = serializers.BooleanField()
    message = serializers.CharField()



# ==================== パスワードリセット（新規登録方式）====================

class PasswordResetTokenVerifySerializer(serializers.Serializer):
    """パスワードリセットトークン検証用シリアライザー"""
    uid = serializers.CharField()
    token = serializers.CharField()


class PasswordResetByUserIdSerializer(serializers.Serializer):
    """user_idでパスワードリセット用シリアライザー"""
    user_id = serializers.CharField()
    new_password = serializers.CharField(
        write_only=True,
        min_length=8,
        validators=[validate_password]
    )
    
    def validate_new_password(self, value):
        """新しいパスワードのバリデーション"""
        if not value:
            raise serializers.ValidationError("パスワードを入力してください")
        if len(value) < 8:
            raise serializers.ValidationError("パスワードは8文字以上で入力してください")
        return value