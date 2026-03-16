import uuid
from django.db import models
from django.contrib.auth.models import User

class Group(models.Model):
    name = models.CharField(max_length=100)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    members = models.ManyToManyField(User, related_name='expense_groups')
    created_at = models.DateTimeField(auto_now_add=True)
    invite_code = models.CharField(max_length=12, unique=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.invite_code:
            self.invite_code = uuid.uuid4().hex[:12]
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class UserDebt(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='user_debts')
    username = models.CharField(max_length=150)
    net_debt = models.IntegerField(default=0)

    class Meta:
        unique_together = ('group', 'username')

    def __str__(self):
        return f"{self.username}: {self.net_debt} in {self.group.name}"

class Debt(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='debts')
    from_user = models.CharField(max_length=150)
    to_user = models.CharField(max_length=150)
    amount = models.IntegerField()

    class Meta:
        unique_together = ('group', 'from_user', 'to_user')

    def __str__(self):
        return f"{self.from_user} -> {self.to_user}: {self.amount}"

class OptimisedDebt(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='optimised_debts')
    from_user = models.CharField(max_length=150)
    to_user = models.CharField(max_length=150)
    amount = models.IntegerField()

    def __str__(self):
        return f"{self.from_user} -> {self.to_user}: {self.amount}"

class Expense(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='expenses')
    title = models.CharField(max_length=100)
    author = models.CharField(max_length=150)
    lender = models.CharField(max_length=150)
    amount = models.IntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.author = self.author.lower()
        self.lender = self.lender.lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.title} - {self.amount}"

class ExpenseLender(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='lenders')
    username = models.CharField(max_length=150)
    amount = models.IntegerField()

    def __str__(self):
        return f"{self.username}: {self.amount}"

class ExpenseBorrower(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='borrowers')
    username = models.CharField(max_length=150)
    amount = models.IntegerField()

    def __str__(self):
        return f"{self.username}: {self.amount}"

class ExpenseComment(models.Model):
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, related_name='comments')
    author = models.CharField(max_length=150)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.author} on {self.expense.title}: {self.text[:20]}"

class ActivityLog(models.Model):
    ACTION_CHOICES = [
        ('expense_added', 'Expense Added'),
        ('expense_edited', 'Expense Edited'),
        ('expense_deleted', 'Expense Deleted'),
        ('settlement', 'Settlement'),
        ('member_added', 'Member Added'),
        ('member_removed', 'Member Removed'),
        ('group_created', 'Group Created'),
    ]
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='activities')
    user = models.CharField(max_length=150)
    action = models.CharField(choices=ACTION_CHOICES, max_length=50)
    description = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user} {self.get_action_display()} in {self.group.name}"

