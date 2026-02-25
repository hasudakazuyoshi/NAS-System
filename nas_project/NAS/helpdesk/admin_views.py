import re
from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from .models import HelpArticle, HelpCategory


def admin_required(user):
    return user.is_staff or user.is_superuser


def get_next_category_id():
    used_ids = set(HelpCategory.objects.values_list('category_id', flat=True))
    for char in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
        if char not in used_ids:
            return char
    return None


def validate_category_name(name):
    """カテゴリ名のバリデーション。エラーメッセージを返す（問題なければNone）"""
    if len(name) < 2:
        return "カテゴリ名は2文字以上で入力してください。"
    if not re.match(r'^[ぁ-んァ-ヶーｦ-ﾟ一-龠々ａ-ｚＡ-Ｚ０-９]+$', name):
        return "カテゴリ名はひらがな・カタカナ・漢字・全角英数のみ使用できます。"
    return None


@user_passes_test(admin_required, login_url='/accounts/login/')
@login_required(login_url='/accounts/login/')
def admin_help_list(request, article_id=None):
    edit_article = None
    if article_id:
        edit_article = get_object_or_404(HelpArticle, pk=article_id)

    if request.method == "POST":
        title = request.POST.get("title", "").strip()
        category_id = request.POST.get("category")
        category_name = request.POST.get("category_name", "").strip()
        content = request.POST.get("content", "").strip()

        if not title or not content:
            messages.error(request, "タイトルと内容は必須です。")
            return redirect("helpdesk:admin_help_list")

        if category_id == "new":
            if not category_name:
                messages.error(request, "新規カテゴリ名を入力してください。")
                return redirect("helpdesk:admin_help_list")

            error = validate_category_name(category_name)
            if error:
                messages.error(request, error)
                return redirect("helpdesk:admin_help_list")

            if HelpCategory.objects.filter(name=category_name).exists():
                messages.error(request, f"「{category_name}」は既に存在するカテゴリです。既存カテゴリから選択してください。")
                return redirect("helpdesk:admin_help_list")

            new_id = get_next_category_id()
            if new_id is None:
                messages.error(request, "カテゴリの上限（26個）に達しています。")
                return redirect("helpdesk:admin_help_list")
            category = HelpCategory.objects.create(pk=new_id, name=category_name)
        else:
            category = get_object_or_404(HelpCategory, pk=category_id)

        if edit_article:
            edit_article.title = title
            edit_article.category = category
            edit_article.content = content
            edit_article.save()
            messages.success(request, "記事を更新しました。")
        else:
            HelpArticle.objects.create(title=title, category=category, content=content)
            messages.success(request, "新しい記事を作成しました。")

        return redirect("helpdesk:admin_help_list")

    articles = HelpArticle.objects.all().order_by("-created_at")
    categories = HelpCategory.objects.all().order_by("category_id")

    return render(request, "helpdesk/admin_help.html", {
        "articles": articles,
        "edit_article": edit_article,
        "categories": categories,
    })


@user_passes_test(admin_required, login_url='/accounts/login/')
@login_required(login_url='/accounts/login/')
def delete_help_article(request, article_id):
    if request.method == "POST":
        article = get_object_or_404(HelpArticle, pk=article_id)
        article.delete()
        messages.success(request, "記事を削除しました。")
    return redirect("helpdesk:admin_help_list")


@user_passes_test(admin_required, login_url='/accounts/login/')
@login_required(login_url='/accounts/login/')
def edit_category(request, category_id):
    if request.method == "POST":
        category = get_object_or_404(HelpCategory, pk=category_id)
        new_name = request.POST.get("category_name", "").strip()

        if not new_name:
            messages.error(request, "カテゴリ名を入力してください。")
            return redirect("helpdesk:admin_help_list")

        error = validate_category_name(new_name)
        if error:
            messages.error(request, error)
            return redirect("helpdesk:admin_help_list")

        if HelpCategory.objects.filter(name=new_name).exclude(pk=category_id).exists():
            messages.error(request, f"「{new_name}」は既に存在するカテゴリ名です。")
            return redirect("helpdesk:admin_help_list")

        category.name = new_name
        category.save()
        messages.success(request, f"カテゴリ名を「{new_name}」に更新しました。")

    return redirect("helpdesk:admin_help_list")


@user_passes_test(admin_required, login_url='/accounts/login/')
@login_required(login_url='/accounts/login/')
def delete_category(request, category_id):
    if request.method == "POST":
        category = get_object_or_404(HelpCategory, pk=category_id)
        category_name = category.name
        category.delete()
        messages.success(request, f"カテゴリ「{category_name}」と紐づく記事を削除しました。")
    return redirect("helpdesk:admin_help_list")