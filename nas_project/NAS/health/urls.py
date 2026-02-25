from django.urls import path
from . import views

app_name = 'health'

urlpatterns = [
    path('body_data/', views.body_data_chart, name='body_data_chart'),
    path('sleep_data/', views.sleep_data_chart, name='sleep_data_chart'),
    path('body_data_json/', views.body_data_json, name='body_data_json'),

    path('sleep_data_json/', views.sleep_data_json, name='sleep_data_json'),


]

