# healthdata/services/health_service.py

from datetime import timedelta
from django.utils import timezone
from django.db import models
from django.db.models import Avg, Min, Max
from .models import HealthData, SleepData


class HealthDataService:
    """健康データ（体温・心拍）のサービス"""
    
    @staticmethod
    def create_health_data(user, data):
        """
        新しい健康データを登録
        
        Args:
            user: Userインスタンス
            data: {
                'measured_at': datetime,
                'body': float,
                'heart_rate': int
            }
        """
        return HealthData.objects.create(
            user=user,
            measured_at=data.get("measured_at", timezone.now()),
            body=data.get("body"),
            heart_rate=data.get("heart_rate"),
        )

    @staticmethod
    def get_recent_data(user, hours=24):
        """
        指定時間内のデータを取得（降順）
        
        Args:
            user: Userインスタンス
            hours: 何時間分取得するか
            
        Returns:
            QuerySet[HealthData]
        """
        since = timezone.now() - timedelta(hours=hours)
        return HealthData.objects.filter(
            user=user, 
            measured_at__gte=since
        ).order_by("-measured_at")

    @staticmethod
    def get_data_by_date_range(user, start_date, end_date):
        """
        日付範囲でデータを取得（グラフ表示用）
        
        Args:
            user: Userインスタンス
            start_date: datetime or str "2026-01-01"
            end_date: datetime or str "2026-01-31"
            
        Returns:
            QuerySet[HealthData]
        """
        return HealthData.objects.filter(
            user=user,
            measured_at__date__gte=start_date,
            measured_at__date__lte=end_date
        ).order_by("measured_at")

    @staticmethod
    def get_average_data(user, days=7):
        """
        一定期間の平均値を計算
        
        Args:
            user: Userインスタンス
            days: 何日分計算するか
            
        Returns:
            dict: {
                'average_body': float,
                'average_heart_rate': float,
                'min_body': float,
                'max_body': float,
                'min_heart_rate': int,
                'max_heart_rate': int,
                'data_count': int
            }
        """
        since = timezone.now() - timedelta(days=days)
        qs = HealthData.objects.filter(user=user, measured_at__gte=since)

        if not qs.exists():
            return None

        # 一度に集計
        stats = qs.aggregate(
            avg_body=Avg("body"),
            avg_hr=Avg("heart_rate"),
            min_body=Min("body"),
            max_body=Max("body"),
            min_hr=Min("heart_rate"),
            max_hr=Max("heart_rate"),
            count=models.Count("id"),
        )

        return {
            "average_body": round(stats["avg_body"], 1) if stats["avg_body"] else None,
            "average_heart_rate": round(stats["avg_hr"]) if stats["avg_hr"] else None,
            "min_body": stats["min_body"],
            "max_body": stats["max_body"],
            "min_heart_rate": stats["min_hr"],
            "max_heart_rate": stats["max_hr"],
            "data_count": stats["count"],
        }

    @staticmethod
    def get_hourly_data(user, date):
        """
        特定日の時間別データを取得（24時間分）
        
        Args:
            user: Userインスタンス
            date: datetime.date or str "2026-01-30"
            
        Returns:
            QuerySet[HealthData]
        """
        return HealthData.objects.filter(
            user=user,
            measured_at__date=date
        ).order_by("measured_at")


class SleepDataService:
    """睡眠データのサービス"""
    
    @staticmethod
    def create_sleep_data(user, data):
        """
        新しい睡眠データを登録（既存データがあれば更新）
        
        Args:
            user: Userインスタンス
            data: {
                'date': date or str "2026-01-30",
                'sleep_hours': float,
                'sleep_quality': str (optional)
            }
        """
        date = data.get("date")
        sleep_hours = data.get("sleep_hours")
        sleep_quality = data.get("sleep_quality", "good")
        
        # update_or_createで重複を防ぐ
        sleep_data, created = SleepData.objects.update_or_create(
            user=user,
            date=date,
            defaults={
                'sleep_hours': sleep_hours,
                'sleep_quality': sleep_quality,
            }
        )
        
        return sleep_data, created

    @staticmethod
    def get_recent_sleep(user, days=7):
        """
        最近の睡眠データを取得
        
        Args:
            user: Userインスタンス
            days: 何日分取得するか
            
        Returns:
            QuerySet[SleepData]
        """
        since = timezone.now().date() - timedelta(days=days)
        return SleepData.objects.filter(
            user=user,
            date__gte=since
        ).order_by("-date")

    @staticmethod
    def get_sleep_by_date_range(user, start_date, end_date):
        """
        日付範囲で睡眠データを取得（グラフ表示用）
        
        Args:
            user: Userインスタンス
            start_date: date or str "2026-01-01"
            end_date: date or str "2026-01-31"
            
        Returns:
            QuerySet[SleepData]
        """
        return SleepData.objects.filter(
            user=user,
            date__gte=start_date,
            date__lte=end_date
        ).order_by("date")

    @staticmethod
    def get_sleep_statistics(user, days=30):
        """
        睡眠統計を計算
        
        Args:
            user: Userインスタンス
            days: 何日分計算するか
            
        Returns:
            dict: {
                'average_sleep_hours': float,
                'total_days': int,
                'quality_distribution': dict
            }
        """
        since = timezone.now().date() - timedelta(days=days)
        qs = SleepData.objects.filter(user=user, date__gte=since)

        if not qs.exists():
            return None

        # 平均睡眠時間
        avg_sleep = qs.aggregate(avg=Avg("sleep_hours"))["avg"]
        
        # 睡眠の質の分布
        quality_dist = {}
        for quality in ['excellent', 'good', 'poor', 'insufficient']:
            count = qs.filter(sleep_quality=quality).count()
            if count > 0:
                quality_dist[quality] = count

        return {
            "average_sleep_hours": round(avg_sleep, 1) if avg_sleep else None,
            "total_days": qs.count(),
            "quality_distribution": quality_dist,
        }