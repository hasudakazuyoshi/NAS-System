# system_log/management/commands/import_access_logs.py
from django.core.management.base import BaseCommand
from django.conf import settings
import json
import os
from dateutil import parser
from system_log.models import AccessLog


class Command(BaseCommand):
    help = 'JSONファイルからアクセスログをDBにインポート'
    
    def handle(self, *args, **options):
        # JSONファイルのパス
        json_path = os.path.join(
            settings.BASE_DIR, 'static', 'data', 'access_logs.json'
        )
        
        if not os.path.exists(json_path):
            self.stdout.write(
                self.style.WARNING(f'JSONファイルが見つかりません: {json_path}')
            )
            return
        
        # JSONファイルを読み込み
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                logs = json.load(f)
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'JSONファイルの読み込みエラー: {e}')
            )
            return
        
        # データのインポート
        imported_count = 0
        skipped_count = 0
        
        for log in logs:
            # action_type が SESSION のもののみインポート
            if log.get('action_type') != 'SESSION':
                skipped_count += 1
                continue
            
            # action が login または logout のもののみ
            action = log.get('action')
            if action not in ['login', 'logout']:
                skipped_count += 1
                continue
            
            try:
                AccessLog.objects.create(
                    user_id=log.get('user_id'),
                    action=action,
                    timestamp=parser.parse(log.get('timestamp'))
                )
                imported_count += 1
            except Exception as e:
                self.stdout.write(
                    self.style.WARNING(f'ログのインポート失敗: {e}')
                )
                skipped_count += 1
        
        # 結果表示
        self.stdout.write(
            self.style.SUCCESS(
                f'インポート完了: {imported_count}件成功, {skipped_count}件スキップ'
            )
        )