from django.db import models

class HelpCategory(models.Model):
    category_id = models.CharField(
        max_length=1,
        primary_key=True,
        verbose_name="カテゴリID（A〜Z）"
    )
    name = models.CharField(max_length=50, verbose_name="カテゴリ名")

    class Meta:
        db_table = "help_category"

    def __str__(self):
        return f"{self.category_id}：{self.name}"


class HelpArticle(models.Model):
    help_id = models.CharField(max_length=4, primary_key=True, blank=True)
    category = models.ForeignKey(
        HelpCategory,
        on_delete=models.CASCADE,
        db_column="category_id"
    )
    title = models.CharField(max_length=200, verbose_name="タイトル")
    content = models.TextField(verbose_name="内容")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="作成日時")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="更新日時")

    class Meta:
        db_table = "help"

    def save(self, *args, **kwargs):
        # help_id が指定されていない時に自動生成
        if not self.help_id:
            prefix = self.category.category_id  # A, B, C...
            last_article = HelpArticle.objects.filter(
                help_id__startswith=prefix
            ).order_by('-help_id').first()

            if last_article:
                last_num = int(last_article.help_id[1:])
                next_num = last_num + 1
            else:
                next_num = 1

            self.help_id = f"{prefix}{next_num:03d}"

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.help_id}：{self.title}"

