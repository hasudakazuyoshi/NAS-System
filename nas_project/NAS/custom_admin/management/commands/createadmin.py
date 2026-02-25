# custom_admin/management/commands/createadmin.py

from django.core.management.base import BaseCommand
from accounts.models import AdminUser

class Command(BaseCommand):
    help = "Create AdminUser (管理者アカウント作成)"

    def add_arguments(self, parser):
        parser.add_argument('--email', type=str, required=True)
        parser.add_argument('--password', type=str, required=True)

    def handle(self, *args, **options):
        email = options['email']
        password = options['password']

        # 管理者作成
        admin = AdminUser.objects.create_user(
            email=email,
            password=password,
            is_staff=True,
            is_superuser=True,
        )

        self.stdout.write(self.style.SUCCESS(
            f"AdminUser created: {admin.admin_id} / {admin.email}"
        ))
