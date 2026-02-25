from django.urls import path, include

app_name = 'api'

urlpatterns = [
    # 認証API
    path('auth/', include('api.auth.urls')),
    
    # ヘルスAPI
    path('health/', include('api.health.urls')),
    
    # ヘルプデスクAPI
    path('helpdesk/', include('api.helpdesk.urls')),
]