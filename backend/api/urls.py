from django.urls import path
from . import views

urlpatterns = [
    # Auth
    path('auth/signup', views.signup),
    path('auth/login', views.login_view),
    path('auth/logout', views.logout_view),
    path('auth/me', views.me),

    # Groups
    path('groups', views.groups_list),
    path('groups/<int:group_id>', views.group_detail),
    path('groups/<int:group_id>/members', views.group_add_member),

    # Group-scoped Endpoints
    path('groups/<int:group_id>/users', views.users_list),
    path('groups/<int:group_id>/expenses', views.expenses_list),
    path('groups/<int:group_id>/expenses/settlement', views.expense_settlement),
    path('groups/<int:group_id>/expenses/<int:expense_id>', views.expense_detail),
    path('groups/<int:group_id>/expenses/<int:expense_id>/comments', views.expense_comments),
    path('groups/<int:group_id>/expenses/<int:expense_id>/comments/<int:comment_id>', views.delete_comment),
    path('groups/<int:group_id>/debts', views.debts_list),
    path('groups/<int:group_id>/optimisedDebts', views.optimised_debts_list),
    path('groups/<int:group_id>/debts/add', views.debt_add),
    path('groups/<int:group_id>/debts/settle', views.debt_settle),
    path('groups/<int:group_id>/debts/<str:from_user>/<str:to_user>', views.debt_detail),
    path('groups/<int:group_id>/activity', views.activity_list),
    path('groups/<int:group_id>/ai-chat', views.group_ai_chat),
]
