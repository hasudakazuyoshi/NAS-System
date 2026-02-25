from django.apps import AppConfig


class CustomAdminConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'custom_admin'

    label = 'nas_admin'  # Custom app label to avoid conflict with django.contrib.admin