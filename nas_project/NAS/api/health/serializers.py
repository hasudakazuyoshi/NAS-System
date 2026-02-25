from rest_framework import serializers
from health.models import HealthData, SleepData


class HealthDataSerializer(serializers.ModelSerializer):
    """身体データのシリアライザー"""
    user_id = serializers.CharField(source='user.user_id', read_only=True)
    
    class Meta:
        model = HealthData
        fields = ['id', 'user', 'user_id', 'measured_at', 'body', 'heart_rate']
        read_only_fields = ['id', 'user', 'user_id']


class HealthDataCreateSerializer(serializers.ModelSerializer):
    """身体データ登録用シリアライザー"""
    class Meta:
        model = HealthData
        fields = ['measured_at', 'body', 'heart_rate']
        
    def validate_body(self, value):
        """体温の範囲チェック"""
        if value < 30.0 or value > 45.0:
            raise serializers.ValidationError("体温は30.0〜45.0の範囲で入力してください")
        return value
    
    def validate_heart_rate(self, value):
        """心拍数の範囲チェック"""
        if value < 30 or value > 250:
            raise serializers.ValidationError("心拍数は30〜250の範囲で入力してください")
        return value


class SleepDataSerializer(serializers.ModelSerializer):
    """睡眠データのシリアライザー"""
    user_id = serializers.CharField(source='user.user_id', read_only=True)
    
    class Meta:
        model = SleepData
        fields = ['id', 'user', 'user_id', 'date', 'sleep_hours']
        read_only_fields = ['id', 'user', 'user_id']


class SleepDataCreateSerializer(serializers.ModelSerializer):
    """睡眠データ登録用シリアライザー"""
    class Meta:
        model = SleepData
        fields = ['date', 'sleep_hours']
        
    def validate_sleep_hours(self, value):
        """睡眠時間の範囲チェック"""
        if value < 0 or value > 24:
            raise serializers.ValidationError("睡眠時間は0〜24時間の範囲で入力してください")
        return value


class WeeklyHealthDataSerializer(serializers.Serializer):
    """週間身体データのシリアライザー"""
    labels = serializers.ListField(child=serializers.CharField())
    heart_rate = serializers.ListField(child=serializers.IntegerField(allow_null=True))  # ✅ IntegerFieldに変更
    temperature = serializers.ListField(child=serializers.FloatField(allow_null=True))
    period_label = serializers.CharField()


class WeeklySleepDataSerializer(serializers.Serializer):
    """週間睡眠データのシリアライザー"""
    labels = serializers.ListField(child=serializers.CharField())
    sleep_hours = serializers.ListField(child=serializers.FloatField(allow_null=True))
    period_label = serializers.CharField()


class HealthSummarySerializer(serializers.Serializer):
    """ヘルスデータサマリー用シリアライザー"""
    latest_body_temp = serializers.FloatField(allow_null=True)
    latest_heart_rate = serializers.IntegerField(allow_null=True)  # ✅ IntegerFieldに変更
    latest_sleep_hours = serializers.FloatField(allow_null=True)
    avg_body_temp_week = serializers.FloatField(allow_null=True)
    avg_heart_rate_week = serializers.IntegerField(allow_null=True)  # ✅ IntegerFieldに変更
    avg_sleep_hours_week = serializers.FloatField(allow_null=True)
    total_records = serializers.IntegerField()