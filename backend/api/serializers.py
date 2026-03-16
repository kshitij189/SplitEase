from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Group, UserDebt, Debt, OptimisedDebt, Expense, ExpenseBorrower, ActivityLog, ExpenseComment, ExpenseLender

class AuthUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']

class GroupSerializer(serializers.ModelSerializer):
    members = AuthUserSerializer(many=True, read_only=True)
    created_by = AuthUserSerializer(read_only=True)
    
    class Meta:
        model = Group
        fields = ['id', 'name', 'created_by', 'members', 'created_at', 'invite_code']

class UserDebtSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserDebt
        fields = ['id', 'group', 'username', 'net_debt']

class DebtSerializer(serializers.ModelSerializer):
    class Meta:
        model = Debt
        fields = ['id', 'group', 'from_user', 'to_user', 'amount']

class OptimisedDebtSerializer(serializers.ModelSerializer):
    class Meta:
        model = OptimisedDebt
        fields = ['id', 'group', 'from_user', 'to_user', 'amount']

class ExpenseBorrowerSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseBorrower
        fields = ['username', 'amount']

class ExpenseLenderSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseLender
        fields = ['username', 'amount']

class ExpenseCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExpenseComment
        fields = ['id', 'expense', 'author', 'text', 'created_at']

class ExpenseSerializer(serializers.ModelSerializer):
    borrowers = ExpenseBorrowerSerializer(many=True, read_only=True)
    lenders = ExpenseLenderSerializer(many=True, read_only=True)
    comments = ExpenseCommentSerializer(many=True, read_only=True)

    class Meta:
        model = Expense
        fields = ['id', 'group', 'title', 'author', 'lender', 'lenders', 'borrowers', 'comments', 'amount', 'created_at']

class ActivityLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityLog
        fields = ['id', 'group', 'user', 'action', 'description', 'created_at']
