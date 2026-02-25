from datetime import date, timedelta, datetime
from zoneinfo import ZoneInfo
from django.db.models import Avg
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from health.models import HealthData, SleepData
from .serializers import (
    HealthDataSerializer,
    HealthDataCreateSerializer,
    SleepDataSerializer,
    SleepDataCreateSerializer,
    WeeklyHealthDataSerializer,
    WeeklySleepDataSerializer,
    HealthSummarySerializer,
)


# ==========================================================
# 身体データ一覧・登録
# ==========================================================
class HealthDataListCreateView(generics.ListCreateAPIView):
    """身体データの一覧取得・登録"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return HealthData.objects.filter(user=self.request.user).order_by('-measured_at')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return HealthDataCreateSerializer
        return HealthDataSerializer
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ==========================================================
# 身体データ詳細・更新・削除
# ==========================================================
class HealthDataDetailView(generics.RetrieveUpdateDestroyAPIView):
    """身体データの詳細取得・更新・削除"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = HealthDataSerializer
    
    def get_queryset(self):
        return HealthData.objects.filter(user=self.request.user)


# ==========================================================
# 睡眠データ一覧・登録
# ==========================================================
class SleepDataListCreateView(generics.ListCreateAPIView):
    """睡眠データの一覧取得・登録"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return SleepData.objects.filter(user=self.request.user).order_by('-date')
    
    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SleepDataCreateSerializer
        return SleepDataSerializer
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ==========================================================
# 睡眠データ詳細・更新・削除
# ==========================================================
class SleepDataDetailView(generics.RetrieveUpdateDestroyAPIView):
    """睡眠データの詳細取得・更新・削除"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SleepDataSerializer
    
    def get_queryset(self):
        return SleepData.objects.filter(user=self.request.user)


# ==========================================================
# ✅ ヘルパー関数: 日本時間ベースで週の範囲を取得
# ==========================================================
def get_week_range_jst(weeks_ago=0):
    """
    週の範囲を取得（日曜始まり、土曜終わり）- 日本時間ベース

    Args:
        weeks_ago: 何週間前か (0=今週, 1=先週, ...)

    Returns:
        tuple: (start_date, end_date, date_list)
    """
    jst = ZoneInfo('Asia/Tokyo')
    today = timezone.now().astimezone(jst).date()

    days_since_sunday = (today.weekday() + 1) % 7
    this_sunday = today - timedelta(days=days_since_sunday)
    start_of_week = this_sunday - timedelta(weeks=weeks_ago)
    end_of_week = start_of_week + timedelta(days=6)
    date_list = [start_of_week + timedelta(days=i) for i in range(7)]
    return start_of_week, end_of_week, date_list


# ==========================================================
# 週間身体データ取得
# ==========================================================
class WeeklyHealthDataView(APIView):
    """週間身体データ取得API"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        weeks_ago = int(request.GET.get("weeks_ago", 0))

        jst = ZoneInfo('Asia/Tokyo')
        start_of_week, end_of_week, date_list = get_week_range_jst(weeks_ago)

        labels = ["日", "月", "火", "水", "木", "金", "土"]
        heart_rate = []
        temperature = []

        # ✅ 事前フィルタを廃止し、各曜日ごとにJSTで直接クエリ
        # 理由：事前フィルタはUTC日付基準になり、JST深夜帯（23:00 UTC = 翌08:00 JST）の
        #       データが別の曜日に分類されてしまうため
        for day in date_list:
            day_start = timezone.make_aware(
                datetime.combine(day, datetime.min.time()), jst
            )
            day_end = timezone.make_aware(
                datetime.combine(day, datetime.max.time()), jst
            )

            day_data = HealthData.objects.filter(
                user=user,
                measured_at__gte=day_start,
                measured_at__lte=day_end
            )

            if day_data.exists():
                avg = day_data.aggregate(
                    avg_hr=Avg('heart_rate'),
                    avg_temp=Avg('body')
                )
                heart_rate.append(round(avg['avg_hr']) if avg['avg_hr'] else None)
                # ✅ float()でDecimal型エラーを防ぐ
                temperature.append(round(float(avg['avg_temp']), 1) if avg['avg_temp'] else None)
            else:
                heart_rate.append(None)
                temperature.append(None)

        period_label = f"{start_of_week.month}/{start_of_week.day} ~ {end_of_week.month}/{end_of_week.day}"

        data = {
            "labels": labels,
            "heart_rate": heart_rate,
            "temperature": temperature,
            "period_label": period_label
        }

        serializer = WeeklyHealthDataSerializer(data)
        return Response(serializer.data)


# ==========================================================
# 週間睡眠データ取得
# ==========================================================
class WeeklySleepDataView(APIView):
    """週間睡眠データ取得API"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        weeks_ago = int(request.GET.get("weeks_ago", 0))

        # ✅ 睡眠データは `date` フィールド（日付型）なので
        # タイムゾーンのズレは発生しない。変更不要。
        start_of_week, end_of_week, date_list = get_week_range_jst(weeks_ago)

        datas = SleepData.objects.filter(
            user=user,
            date__range=[start_of_week, end_of_week]
        ).order_by("date")

        labels = ["日", "月", "火", "水", "木", "金", "土"]
        sleep_hours = []
        data_dict = {d.date: d for d in datas}

        for day in date_list:
            d = data_dict.get(day)
            if d:
                sleep_hours.append(float(d.sleep_hours))
            else:
                sleep_hours.append(None)

        period_label = f"{start_of_week.month}/{start_of_week.day} ~ {end_of_week.month}/{end_of_week.day}"

        data = {
            "labels": labels,
            "sleep_hours": sleep_hours,
            "period_label": period_label
        }

        serializer = WeeklySleepDataSerializer(data)
        return Response(serializer.data)


# ==========================================================
# ヘルスデータサマリー
# ==========================================================
class HealthSummaryView(APIView):
    """ヘルスデータのサマリー情報取得"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user

        latest_health = HealthData.objects.filter(user=user).order_by('-measured_at').first()
        latest_sleep = SleepData.objects.filter(user=user).order_by('-date').first()

        jst = ZoneInfo('Asia/Tokyo')
        today_jst = timezone.now().astimezone(jst).date()
        week_ago = today_jst - timedelta(days=7)

        week_ago_start = timezone.make_aware(
            datetime.combine(week_ago, datetime.min.time()), jst
        )

        week_health_avg = HealthData.objects.filter(
            user=user,
            measured_at__gte=week_ago_start
        ).aggregate(
            avg_temp=Avg('body'),
            avg_hr=Avg('heart_rate')
        )

        week_sleep_avg = SleepData.objects.filter(
            user=user,
            date__gte=week_ago
        ).aggregate(
            avg_sleep=Avg('sleep_hours')
        )

        total_records = HealthData.objects.filter(user=user).count()

        data = {
            "latest_body_temp": float(latest_health.body) if latest_health else None,
            "latest_heart_rate": int(latest_health.heart_rate) if latest_health else None,
            "latest_sleep_hours": float(latest_sleep.sleep_hours) if latest_sleep else None,
            "avg_body_temp_week": round(float(week_health_avg['avg_temp']), 1) if week_health_avg['avg_temp'] else None,
            "avg_heart_rate_week": round(week_health_avg['avg_hr']) if week_health_avg['avg_hr'] else None,
            "avg_sleep_hours_week": round(float(week_sleep_avg['avg_sleep']), 1) if week_sleep_avg['avg_sleep'] else None,
            "total_records": total_records
        }

        serializer = HealthSummarySerializer(data)
        return Response(serializer.data)