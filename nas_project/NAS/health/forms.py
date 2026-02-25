from django import forms
from .models import BodyData

class BodyDataForm(forms.ModelForm):
    class Meta:
        model = BodyData
        fields = ['temperature', 'heart_rate', 'sleep_duration']
