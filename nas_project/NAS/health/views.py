# health/views.py

from datetime import date, timedelta, datetime
from zoneinfo import ZoneInfo
from django.shortcuts import render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.db.models import Avg
from django.utils import timezone
from .models import HealthData, SleepData


def get_week_range(weeks_ago=0):
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


@login_required
def body_data_chart(request):
    """身体データグラフページ"""
    return render(request, 'health/body_data_chart.html')


@login_required
def sleep_data_chart(request):
    """睡眠データグラフページ"""
    return render(request, 'health/sleep_data_chart.html')


@login_required
def body_data_json(request):
    """
    身体データJSON（週単位）- 日本時間ベース
    Query: ?weeks_ago=0 (今週), 1 (先週), ...
    """
    user = request.user
    weeks_ago = int(request.GET.get("weeks_ago", 0))

    jst = ZoneInfo('Asia/Tokyo')
    start_of_week, end_of_week, date_list = get_week_range(weeks_ago)

    labels = ["日", "月", "火", "水", "木", "金", "土"]
    heart_rate = []
    temperature = []

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
            temperature.append(round(float(avg['avg_temp']), 1) if avg['avg_temp'] else None)
        else:
            heart_rate.append(None)
            temperature.append(None)

    period_label = f"{start_of_week.month}/{start_of_week.day} ~ {end_of_week.month}/{end_of_week.day}"

    return JsonResponse({
        "labels": labels,
        "heart_rate": heart_rate,
        "temperature": temperature,
        "period_label": period_label,
    })


@login_required
def sleep_data_json(request):
    """
    睡眠データJSON（週単位）- 日本時間ベース
    Query: ?weeks_ago=0 (今週), 1 (先週), ...
    """
    user = request.user
    weeks_ago = int(request.GET.get("weeks_ago", 0))

    start_of_week, end_of_week, date_list = get_week_range(weeks_ago)

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

    return JsonResponse({
        "labels": labels,
        "sleep_hours": sleep_hours,
        "period_label": period_label,
    })