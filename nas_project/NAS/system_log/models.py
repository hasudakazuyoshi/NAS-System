# system_log/models.py
from django.db import models


class AccessLog(models.Model):
    """
    アクセスログモデル - ログイン・ログアウトの記録
    """
    # ユーザー識別
    user_id = models.CharField(
        max_length=20,
        db_index=True,
        help_text="カスタムユーザーID (NU00001, NA00001など)"
    )
    
    # ログイン or ログアウト
    action = models.CharField(
        max_length=10,
        choices=[
            ('login', 'ログイン'),
            ('logout', 'ログアウト'),
        ],
        db_index=True
    )
    
    # タイムスタンプ
    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True
    )
    
    class Meta:
        db_table = 'access_log'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['user_id', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.user_id} - {self.action} at {self.timestamp}"