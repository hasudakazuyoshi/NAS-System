from django import forms

class UserProfileRegistrationForm(forms.Form):
    """
    仮登録後の、パスワードおよびプロフィール詳細情報を登録するためのフォーム。
    """
    # 必須フィールド
    email = forms.EmailField(
        # HiddenInputでもクラスを追加
        widget=forms.HiddenInput(attrs={'class': 'form-control'}) 
    )
    password = forms.CharField(
        label='パスワード',
        # ✅ form-control クラスを追加
        widget=forms.PasswordInput(attrs={'class': 'form-control'}), 
        min_length=8,
        help_text='8文字以上の英数字で入力してください。'
    )
    password_confirm = forms.CharField(
        label='確認用パスワード',
        # ✅ form-control クラスを追加
        widget=forms.PasswordInput(attrs={'class': 'form-control'}),
        min_length=8
    )
    gender = forms.ChoiceField(
        label='性別',
        # ✅ form-control クラスを追加
        widget=forms.Select(attrs={'class': 'form-control'}),
        choices=[
            ('', '選択してください'),
            ('男性', '男'),
            ('女性', '女')
        ]
    )
    birthday = forms.DateField(
        label='生年月日',
        # ✅ form-control クラスと type="date" を追加
        widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date'})
    )
    height = forms.DecimalField(
        label='身長 (cm)',
        required=False,
        max_digits=5,
        decimal_places=1,
        max_value=250,
        min_value=30,
        # ✅ form-control クラスを追加
        widget=forms.NumberInput(attrs={'class': 'form-control'})
    )
    weight = forms.DecimalField(
        label='体重 (kg)',
        required=False,
        max_digits=5,
        decimal_places=1,
        max_value=300,
        min_value=10,
        # ✅ form-control クラスを追加
        widget=forms.NumberInput(attrs={'class': 'form-control'})
    )
    device_id = forms.CharField(
        label='ウェアラブル機器ID',
        required=False,
        # ✅ form-control クラスを追加
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': '機器ID'})
    )
    
    def clean(self):
        """パスワードの一致確認とカスタムバリデーション"""
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        password_confirm = cleaned_data.get("password_confirm")
        
        # パスワード一致チェック
        if password and password_confirm and password != password_confirm:
            # フィールドに紐づかないエラー（non_field_errors）として処理
            raise forms.ValidationError("パスワードと確認用パスワードが一致しません。")
            
        return cleaned_data