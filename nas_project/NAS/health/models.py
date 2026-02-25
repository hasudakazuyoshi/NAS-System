# healthdata/models.py (改善版)

from django.db import models
from django.conf import settings
from accounts.models import User

class HealthData(models.Model):
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        db_column='user_id',
        related_name='health_data'  # ✅ 逆参照を明示
    )
    measured_at = models.DateTimeField(
        db_index=True  # ✅ 検索高速化
    )
    body = models.DecimalField(
        max_digits=4, 
        decimal_places=2,
        help_text="体温 (℃)"
    )
    heart_rate = models.IntegerField(  # ✅ DecimalField → IntegerField
        help_text="心拍数 (bpm)"
    )
    created_at = models.DateTimeField(auto_now_add=True)  # ✅ 作成日時を記録

    class Meta:
        db_table = 'healthdata'
        ordering = ['-measured_at']  # ✅ デフォルトで新しい順
        indexes = [
            models.Index(fields=['user', 'measured_at']),  # ✅ 複合インデックス
            models.Index(fields=['measured_at']),
        ]
        verbose_name = '健康データ'
        verbose_name_plural = '健康データ'

    def __str__(self):
        return f"{self.user.user_id} - {self.measured_at.strftime('%Y-%m-%d %H:%M')}"


class SleepData(models.Model):
    QUALITY_CHOICES = [
        ('excellent', '非常に良い'),
        ('good', '良い'),
        ('poor', '悪い'),
        ('insufficient', '不足'),
    ]
    
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        db_column='user_id',
        related_name='sleep_data'  # ✅ 逆参照を明示
    )
    date = models.DateField(
        db_index=True  # ✅ 検索高速化
    )
    sleep_hours = models.DecimalField(
        max_digits=4, 
        decimal_places=2,
        help_text="睡眠時間 (時間)"
    )
    sleep_quality = models.CharField(  # ✅ 睡眠の質を追加
        max_length=20,
        choices=QUALITY_CHOICES,
        default='good',
        null=True,
        blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)  # ✅ 作成日時を記録

    class Meta:
        db_table = 'sleepdata'
        unique_together = ('user', 'date')
        ordering = ['-date']  # ✅ デフォルトで新しい順
        indexes = [
            models.Index(fields=['user', 'date']),  # ✅ 複合インデックス
        ]
        verbose_name = '睡眠データ'
        verbose_name_plural = '睡眠データ'

    def __str__(self):
        return f"{self.user.user_id} - {self.date} ({self.sleep_hours}h)"