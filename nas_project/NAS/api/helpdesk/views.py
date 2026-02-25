from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from helpdesk.models import HelpArticle, HelpCategory
from helpdesk.services import InquiryService
from helpdesk.bot_logic import get_bot_response
from .serializers import (
    HelpCategorySerializer,
    HelpArticleSerializer,
    HelpArticleListSerializer,
    InquiryListItemSerializer,
    InquiryDetailSerializer,
    InquiryCreateSerializer,
    InquiryMessageSerializer,
    InquiryResponseSerializer,
    ChatbotRequestSerializer,
    ChatbotResponseSerializer,
)


# ==========================================================
# ヘルプ記事 API
# ==========================================================
class HelpCategoryListView(generics.ListAPIView):
    """ヘルプカテゴリ一覧取得"""
    queryset = HelpCategory.objects.all()
    serializer_class = HelpCategorySerializer
    permission_classes = [permissions.AllowAny]


class HelpArticleListView(generics.ListAPIView):
    """ヘルプ記事一覧取得"""
    queryset = HelpArticle.objects.all().order_by('-created_at')
    serializer_class = HelpArticleListSerializer
    permission_classes = [permissions.AllowAny]
    
    def get_queryset(self):
        """カテゴリでフィルタリング可能"""
        queryset = super().get_queryset()
        category = self.request.query_params.get('category', None)
        if category:
            queryset = queryset.filter(category__category_id=category)
        return queryset


class HelpArticleDetailView(generics.RetrieveAPIView):
    """ヘルプ記事詳細取得"""
    queryset = HelpArticle.objects.all()
    serializer_class = HelpArticleSerializer
    permission_classes = [permissions.AllowAny]
    lookup_field = 'help_id'


class HelpArticleSearchView(APIView):
    """ヘルプ記事検索"""
    permission_classes = [permissions.AllowAny]
    
    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response(
                {"error": "検索キーワードを入力してください"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        articles = HelpArticle.objects.filter(
            title__icontains=query
        ) | HelpArticle.objects.filter(
            content__icontains=query
        )
        
        serializer = HelpArticleListSerializer(articles, many=True)
        return Response({
            "query": query,
            "count": articles.count(),
            "results": serializer.data
        })


# ==========================================================
# 問い合わせ API
# ==========================================================
class InquiryListAPIView(APIView):
    """問い合わせ一覧取得"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        user_id = getattr(user, 'user_id', None)
        
        if not user_id:
            return Response(
                {"error": "ユーザーIDが取得できません"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            inquiries_data = InquiryService.get_inquiries(user_id=user_id)
            serializer = InquiryListItemSerializer(inquiries_data, many=True)
            return Response({
                "success": True,
                "inquiries": serializer.data,
                "inquiry_count": len(inquiries_data)
            })
        except Exception as e:
            return Response(
                {"success": False, "message": f"問い合わせ一覧の取得に失敗しました。{str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class InquiryCreateAPIView(APIView):
    """新規問い合わせ作成"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        user = request.user
        user_id = getattr(user, 'user_id', None)
        
        if not user_id:
            return Response(
                {"error": "ユーザーIDが取得できません"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = InquiryCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            new_inquiry = InquiryService.register_new_inquiry(
                user_id=user_id,
                inquiry_name=serializer.validated_data['inquiry_name'],
                initial_message=serializer.validated_data['initial_message']
            )
            return Response({
                "success": True,
                "message": "問い合わせを登録しました。",
                "inquiry_id": new_inquiry.inquiryID
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {"success": False, "message": f"問い合わせの登録に失敗しました。{str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class InquiryDetailAPIView(APIView):
    """問い合わせ詳細取得"""
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request, inquiry_id):
        user = request.user
        user_id = getattr(user, 'user_id', None)
        
        if not user_id:
            return Response(
                {"error": "ユーザーIDが取得できません"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            detail = InquiryService.get_inquiry_detail(user_id, inquiry_id)
            if not detail:
                return Response(
                    {"success": False, "message": "指定された問い合わせは見つかりませんでした。"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            serializer = InquiryDetailSerializer(detail)
            return Response({"success": True, "detail": serializer.data})
        except Exception as e:
            return Response(
                {"success": False, "message": f"問い合わせ詳細の取得に失敗しました。{str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class InquiryAddMessageAPIView(APIView):
    """問い合わせにメッセージ追加(ユーザー側)"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, inquiry_id):
        user = request.user
        user_id = getattr(user, 'user_id', None)
        
        if not user_id:
            return Response(
                {"error": "ユーザーIDが取得できません"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = InquiryMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            updated_inquiry = InquiryService.add_user_message(
                user_id=user_id,
                inquiry_id=inquiry_id,
                message=serializer.validated_data['message']
            )
            
            if not updated_inquiry:
                return Response(
                    {"success": False, "message": "指定された問い合わせが見つかりませんでした。"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            return Response({
                "success": True,
                "message": "メッセージを送信しました。",
                "status": updated_inquiry.status
            })
        except Exception as e:
            return Response(
                {"success": False, "message": f"メッセージ送信中にエラーが発生しました。{str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class InquiryCloseAPIView(APIView):
    """問い合わせをクローズ"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request, inquiry_id):
        user = request.user
        user_id = getattr(user, 'user_id', None)
        
        if not user_id:
            return Response(
                {"error": "ユーザーIDが取得できません"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            updated_inquiry = InquiryService.close_inquiry(user_id, inquiry_id)
            if not updated_inquiry:
                return Response(
                    {"success": False, "message": "指定された問い合わせが見つかりません。"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            return Response({
                "success": True,
                "message": "問い合わせを解決済みにしました。",
                "status": updated_inquiry.status
            })
        except Exception as e:
            return Response(
                {"success": False, "message": f"ステータス更新中にエラーが発生しました。{str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# ==========================================================
# チャットボット API
# ==========================================================
class ChatbotAPIView(APIView):
    """チャットボットAPI"""
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        serializer = ChatbotRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        message = serializer.validated_data['message']
        user_id = str(request.user.pk) if request.user.is_authenticated else "guest"
        
        try:
            # まずDB内のヘルプ記事を検索
            article = HelpArticle.objects.filter(title__icontains=message).first()
            if article:
                response_data = {"response": article.content}
                response_serializer = ChatbotResponseSerializer(response_data)
                return Response(response_serializer.data)
            
            # Gemini APIで応答生成
            response_text = get_bot_response(user_id, message)
            response_data = {"response": response_text}
            response_serializer = ChatbotResponseSerializer(response_data)
            return Response(response_serializer.data)
            
        except Exception as e:
            return Response(
                {"error": f"チャットボットの応答生成中にエラーが発生しました: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )