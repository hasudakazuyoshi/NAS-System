from rest_framework import serializers
from helpdesk.models import HelpArticle, HelpCategory


class HelpCategorySerializer(serializers.ModelSerializer):
    """ヘルプカテゴリのシリアライザー"""
    class Meta:
        model = HelpCategory
        fields = ['category_id', 'name']


class HelpArticleSerializer(serializers.ModelSerializer):
    """ヘルプ記事のシリアライザー"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = HelpArticle
        fields = [
            'help_id', 'category', 'category_name',
            'title', 'content', 'created_at', 'updated_at'
        ]
        read_only_fields = ['help_id', 'created_at', 'updated_at']


class HelpArticleListSerializer(serializers.ModelSerializer):
    """ヘルプ記事一覧用シリアライザー(contentを除外)"""
    category_name = serializers.CharField(source='category.name', read_only=True)
    
    class Meta:
        model = HelpArticle
        fields = ['help_id', 'category', 'category_name', 'title', 'created_at']


class InquiryThreadSerializer(serializers.Serializer):
    """問い合わせスレッドのシリアライザー"""
    sender = serializers.ChoiceField(choices=['user', 'admin'])
    message = serializers.CharField()
    timestamp = serializers.DateTimeField()


class InquiryListItemSerializer(serializers.Serializer):
    """問い合わせ一覧用シリアライザー"""
    userID = serializers.CharField()
    inquiryID = serializers.CharField()
    inquiryname = serializers.CharField()
    status = serializers.ChoiceField(choices=['未対応', '対応中', '解決済み'])
    time = serializers.CharField()
    latest_message = serializers.CharField()


class InquiryDetailSerializer(serializers.Serializer):
    """問い合わせ詳細シリアライザー"""
    userID = serializers.CharField()
    inquiryID = serializers.CharField()
    inquiryname = serializers.CharField()
    status = serializers.ChoiceField(choices=['未対応', '対応中', '解決済み'])
    time = serializers.CharField()
    thread_history = InquiryThreadSerializer(many=True)


class InquiryCreateSerializer(serializers.Serializer):
    """新規問い合わせ作成用シリアライザー"""
    inquiry_name = serializers.CharField(max_length=200)
    initial_message = serializers.CharField()
    
    def validate_inquiry_name(self, value):
        if not value.strip():
            raise serializers.ValidationError("件名を入力してください")
        return value
    
    def validate_initial_message(self, value):
        if not value.strip():
            raise serializers.ValidationError("メッセージを入力してください")
        return value


class InquiryMessageSerializer(serializers.Serializer):
    """メッセージ送信用シリアライザー"""
    message = serializers.CharField()
    
    def validate_message(self, value):
        if not value.strip():
            raise serializers.ValidationError("メッセージを入力してください")
        return value


class InquiryResponseSerializer(serializers.Serializer):
    """管理者応答用シリアライザー"""
    admin_response = serializers.CharField()
    
    def validate_admin_response(self, value):
        if not value.strip():
            raise serializers.ValidationError("応答メッセージを入力してください")
        return value


class ChatbotRequestSerializer(serializers.Serializer):
    """チャットボットリクエスト用シリアライザー"""
    message = serializers.CharField()
    
    def validate_message(self, value):
        if not value.strip():
            raise serializers.ValidationError("メッセージを入力してください")
        return value


class ChatbotResponseSerializer(serializers.Serializer):
    """チャットボット応答用シリアライザー"""
    response = serializers.CharField()