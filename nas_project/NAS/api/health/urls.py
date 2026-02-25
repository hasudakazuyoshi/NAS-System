from django.urls import path
from .views import (
    HealthDataListCreateView,
    HealthDataDetailView,
    SleepDataListCreateView,
    SleepDataDetailView,
    WeeklyHealthDataView,
    WeeklySleepDataView,
    HealthSummaryView,
)

urlpatterns = [
    # 身体データ
    path('data/', HealthDataListCreateView.as_view(), name='health_data_list'),
    path('data/<int:pk>/', HealthDataDetailView.as_view(), name='health_data_detail'),
    
    # 睡眠データ
    path('sleep/', SleepDataListCreateView.as_view(), name='sleep_data_list'),
    path('sleep/<int:pk>/', SleepDataDetailView.as_view(), name='sleep_data_detail'),
    
    # 週間データ
    path('weekly/body/', WeeklyHealthDataView.as_view(), name='weekly_health'),
    path('weekly/sleep/', WeeklySleepDataView.as_view(), name='weekly_sleep'),
    
    # サマリー
    path('summary/', HealthSummaryView.as_view(), name='health_summary'),
]