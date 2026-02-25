from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from accounts.models import User

class Command(BaseCommand):
    help = '本登録未完了のユーザーを削除（7日以上前に作成されたもの）'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help='何日前のユーザーを削除するか（デフォルト: 7日）'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='実際には削除せず、削除対象を表示するだけ'
        )

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']
        
        # X日以上前に作成された is_active=False のユーザーを取得
        threshold = timezone.now() - timedelta(days=days)
        
        old_inactive_users = User.objects.filter(
            is_active=False,
            date_joined__lt=threshold
        )
        
        count = old_inactive_users.count()
        
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS('削除対象のユーザーはいません')
            )
            return
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(f'【ドライラン】以下の{count}件のユーザーが削除対象です：')
            )
            for user in old_inactive_users:
                self.stdout.write(f'  - {user.email} (作成日: {user.date_joined})')
        else:
            old_inactive_users.delete()
            self.stdout.write(
                self.style.SUCCESS(f'{count}件の未完了ユーザーを削除しました')
            )