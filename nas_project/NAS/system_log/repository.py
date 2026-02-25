# system_log/repository.py
from typing import List, Optional
from datetime import datetime
import logging

from .models import AccessLog

logger = logging.getLogger(__name__)


class LogRepository:
    """
    アクセスログのDB操作を管理するRepository層
    """
    
    @staticmethod
    def log_session_start(user_id: str) -> AccessLog:
        """
        ログインイベントを記録
        """
        return AccessLog.objects.create(
            user_id=user_id,
            action='login'
        )
    
    @staticmethod
    def log_session_end(user_id: str) -> AccessLog:
        """
        ログアウトイベントを記録
        """
        return AccessLog.objects.create(
            user_id=user_id,
            action='logout'
        )
    
    @staticmethod
    def get_logs(
        user_id: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> List[AccessLog]:
        """
        ログを取得(フィルタリング対応)
        """
        queryset = AccessLog.objects.all()
        
        # ユーザーIDフィルタ(部分一致)
        if user_id:
            queryset = queryset.filter(user_id__icontains=user_id)
        
        # 日時範囲フィルタ
        if start_time:
            queryset = queryset.filter(timestamp__gte=start_time)
        if end_time:
            queryset = queryset.filter(timestamp__lte=end_time)
        
        return list(queryset.order_by('-timestamp'))