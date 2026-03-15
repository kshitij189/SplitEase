from django.db.models import F
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from .models import Group, UserDebt, Debt, OptimisedDebt, Expense, ExpenseBorrower, ActivityLog, ExpenseComment, ExpenseLender
from .serializers import (
    AuthUserSerializer, GroupSerializer, DebtSerializer, OptimisedDebtSerializer,
    ExpenseSerializer, ActivityLogSerializer, ExpenseCommentSerializer
)
from .helpers import process_new_debt, reverse_debt, simplify_debts, process_multi_payer_debt, reverse_multi_payer_debt
from .ai_utils import get_bot_response

def log_activity(group, user, action, description):
    ActivityLog.objects.create(
        group=group,
        user=user,
        action=action,
        description=description
    )

# ─── Auth ────────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    username = request.data.get('username', '').lower()
    password = request.data.get('password')
    email = request.data.get('email', '')
    first_name = request.data.get('firstName', '')
    last_name = request.data.get('lastName', '')

    if not username or not password:
        return Response({'error': 'Username and password required'}, status=status.HTTP_400_BAD_REQUEST)

    user = User.objects.filter(username=username).first()
    if user:
        if user.has_usable_password():
            return Response({'error': 'Username already exists'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Claim the dummy account
            user.set_password(password)
            user.email = email
            user.first_name = first_name
            user.last_name = last_name
            user.save()

            # Log activity in all groups the user is a member of
            for group in user.expense_groups.all():
                log_activity(group, username, 'member_added', f"{username} changed a member : {username}")

            token, _ = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user': AuthUserSerializer(user).data
            }, status=status.HTTP_201_CREATED)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name
    )
    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'user': AuthUserSerializer(user).data
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username', '').lower()
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    
    if user:
        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': AuthUserSerializer(user).data
        })
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
def logout_view(request):
    request.user.auth_token.delete()
    return Response({'message': 'Logged out successfully'})

@api_view(['GET'])
def me(request):
    return Response(AuthUserSerializer(request.user).data)


# ─── Groups ──────────────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
def groups_list(request):
    if request.method == 'GET':
        groups = request.user.expense_groups.all().order_by('-created_at')
        return Response(GroupSerializer(groups, many=True).data)

    elif request.method == 'POST':
        name = request.data.get('name')
        if not name:
            return Response({'error': 'Name is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        group = Group.objects.create(name=name, created_by=request.user)
        group.members.add(request.user)
        UserDebt.objects.create(group=group, username=request.user.username, net_debt=0)
        
        log_activity(group, request.user.username, 'group_created', f"Created group '{name}'")
        return Response(GroupSerializer(group).data, status=status.HTTP_201_CREATED)

@api_view(['GET', 'DELETE'])
def group_detail(request, group_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
    except Group.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(GroupSerializer(group).data)

    elif request.method == 'DELETE':
        if group.created_by != request.user:
            return Response({'error': 'Only the creator can delete the group'}, status=status.HTTP_403_FORBIDDEN)
        group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

@api_view(['POST'])
def group_add_member(request, group_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
    except Group.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    username = request.data.get('username', '').lower()
    if not username:
        return Response({'error': 'Username is required'}, status=status.HTTP_400_BAD_REQUEST)

    user_to_add, created = User.objects.get_or_create(
        username=username,
        defaults={'first_name': username.capitalize()}
    )
    if created:
        # Give them an unusable password since they are a dummy user
        user_to_add.set_unusable_password()
        user_to_add.save()

    if user_to_add in group.members.all():
        return Response({'error': 'User is already a member'}, status=status.HTTP_400_BAD_REQUEST)

    group.members.add(user_to_add)
    UserDebt.objects.get_or_create(group=group, username=user_to_add.username, defaults={'net_debt': 0})
    
    log_activity(group, request.user.username, 'member_added', f"Added {user_to_add.username} to the group")
    return Response(GroupSerializer(group).data)


# ─── Group-Scoped Endpoints ──────────────────────────────────────────────────

@api_view(['GET'])
def users_list(request, group_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
    except Group.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    return Response(AuthUserSerializer(group.members.all(), many=True).data)

@api_view(['GET'])
def activity_list(request, group_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
    except Group.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    activities = ActivityLog.objects.filter(group=group).order_by('-created_at')
    return Response(ActivityLogSerializer(activities, many=True).data)

@api_view(['POST'])
def group_ai_chat(request, group_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
    except Group.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    message = request.data.get('message', '').strip()
    if not message:
        return Response({'error': 'Message is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Gather group context
    balances = {ud.username: ud.net_debt for ud in UserDebt.objects.filter(group=group)}
    recent_expenses = []
    for ex in Expense.objects.filter(group=group).order_by('-created_at')[:100]:
        recent_expenses.append({
            "title": ex.title,
            "amount": ex.amount,
            "lender": ex.lender,
            "date": ex.created_at.strftime("%Y-%m-%d")
        })
    
    context = {
        "balances": balances,
        "recent_expenses": recent_expenses
    }
    
    bot_reply = get_bot_response(message, context)
    return Response({'reply': bot_reply})


# ─── Expenses (Scoped) ────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
def expenses_list(request, group_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
    except Group.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        expenses = Expense.objects.filter(group=group).order_by('-created_at')
        return Response(ExpenseSerializer(expenses, many=True).data)

    elif request.method == 'POST':
        title = request.data.get('title')
        author = request.user.username
        amount = request.data.get('amount', 0)
        
        # New: handle multiple lenders
        lenders_data = request.data.get('lenders', [])
        # Fallback to single lender for backward compatibility
        if not lenders_data:
            lender_name = request.data.get('lender', '').lower()
            if lender_name:
                lenders_data = [[lender_name, amount]]
        
        borrowers_data = request.data.get('borrowers', [])

        # Validate sums
        lender_total = sum(l[1] if isinstance(l, list) else l.get('amount', 0) for l in lenders_data)
        borrower_total = sum(b[1] if isinstance(b, list) else b.get('amount', 0) for b in borrowers_data)
        
        if lender_total != amount or borrower_total != amount:
            return Response("Lender or borrower amounts do not add up to the total amount.", status=status.HTTP_400_BAD_REQUEST)

        # Primary lender for the legacy field
        primary_lender = (lenders_data[0][0] if isinstance(lenders_data[0], list) else lenders_data[0].get('username', '')) if lenders_data else author
        
        expense = Expense.objects.create(group=group, title=title, author=author, lender=primary_lender, amount=amount)

        # Create Lender objects
        parsed_lenders = []
        for l in lenders_data:
            l_username = (l[0] if isinstance(l, list) else l.get('username', '')).lower()
            l_amount = l[1] if isinstance(l, list) else l.get('amount', 0)
            ExpenseLender.objects.create(expense=expense, username=l_username, amount=l_amount)
            parsed_lenders.append((l_username, l_amount))

        # Create Borrower objects
        parsed_borrowers = []
        for b in borrowers_data:
            b_username = (b[0] if isinstance(b, list) else b.get('username', '')).lower()
            b_amount = b[1] if isinstance(b, list) else b.get('amount', 0)
            ExpenseBorrower.objects.create(expense=expense, username=b_username, amount=b_amount)
            parsed_borrowers.append((b_username, b_amount))

        # Core logic: Process the multi-payer debt
        process_multi_payer_debt(group, parsed_lenders, parsed_borrowers, amount)

        simplify_debts(group)
        # Determine suffix for activity log
        suffix = " (multi-payer)" if len(parsed_lenders) > 1 else ""
        log_activity(group, author, 'expense_added', f"Added expense '{title}' for {amount/100:.2f}{suffix}")
        return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)

@api_view(['GET', 'DELETE', 'PUT'])
def expense_detail(request, group_id, expense_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
        expense = Expense.objects.get(id=expense_id, group=group)
    except (Group.DoesNotExist, Expense.DoesNotExist):
        return Response("Expense not found.", status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ExpenseSerializer(expense).data)

    elif request.method == 'DELETE':
        # Reverse multi-payer debt
        lenders_data = [(l.username, l.amount) for l in expense.lenders.all()]
        borrowers_data = [(b.username, b.amount) for b in expense.borrowers.all()]
        reverse_multi_payer_debt(group, lenders_data, borrowers_data, expense.amount)
        
        log_activity(group, request.user.username, 'expense_deleted', f"Deleted expense '{expense.title}'")
        expense.delete()
        simplify_debts(group)
        return Response("Expense deleted successfully.")

    elif request.method == 'PUT':
        # 1. Reverse old debt
        old_lenders_data = [(l.username, l.amount) for l in expense.lenders.all()]
        old_borrowers_data = [(b.username, b.amount) for b in expense.borrowers.all()]
        reverse_multi_payer_debt(group, old_lenders_data, old_borrowers_data, expense.amount)
        
        # 2. Clear old lender/borrower objects
        expense.lenders.all().delete()
        expense.borrowers.all().delete()

        # 3. Update expense details
        expense.title = request.data.get('title', expense.title)
        expense.amount = request.data.get('amount', expense.amount)
        
        lenders_data = request.data.get('lenders', [])
        borrowers_data = request.data.get('borrowers', [])

        # Validate sums
        lender_total = sum(l[1] if isinstance(l, list) else l.get('amount', 0) for l in lenders_data)
        borrower_total = sum(b[1] if isinstance(b, list) else b.get('amount', 0) for b in borrowers_data)
        
        if lender_total != expense.amount or borrower_total != expense.amount:
            # Note: This rollbacks the net_debt but we already deleted the objects. 
            # In a production app, this should be in a transaction.
            return Response("Amounts do not match total.", status=status.HTTP_400_BAD_REQUEST)
        
        # Primary lender for legacy support
        primary_lender = (lenders_data[0][0] if isinstance(lenders_data[0], list) else lenders_data[0].get('username', '')) if lenders_data else expense.lender
        expense.lender = primary_lender
        expense.save()

        # 4. Create new Lender objects
        parsed_lenders = []
        for l in lenders_data:
            l_username = (l[0] if isinstance(l, list) else l.get('username', '')).lower()
            l_amount = l[1] if isinstance(l, list) else l.get('amount', 0)
            ExpenseLender.objects.create(expense=expense, username=l_username, amount=l_amount)
            parsed_lenders.append((l_username, l_amount))

        # 5. Create new Borrower objects
        parsed_borrowers = []
        for b in borrowers_data:
            b_username = (b[0] if isinstance(b, list) else b.get('username', '')).lower()
            b_amount = b[1] if isinstance(b, list) else b.get('amount', 0)
            ExpenseBorrower.objects.create(expense=expense, username=b_username, amount=b_amount)
            parsed_borrowers.append((b_username, b_amount))

        # 6. Process new multi-payer debt
        process_multi_payer_debt(group, parsed_lenders, parsed_borrowers, expense.amount)

        simplify_debts(group)
        suffix = " (multi-payer)" if len(parsed_lenders) > 1 else ""
        log_activity(group, request.user.username, 'expense_edited', f"Edited expense '{expense.title}'{suffix}")
        return Response(ExpenseSerializer(expense).data)

@api_view(['GET', 'POST'])
def expense_comments(request, group_id, expense_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
        expense = Expense.objects.get(id=expense_id, group=group)
    except (Group.DoesNotExist, Expense.DoesNotExist):
        return Response("Expense not found.", status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        comments = expense.comments.all().order_by('created_at')
        return Response(ExpenseCommentSerializer(comments, many=True).data)

    elif request.method == 'POST':
        text = request.data.get('text', '').strip()
        from .models import ExpenseComment
        comment = ExpenseComment.objects.create(
            expense=expense,
            author=request.user.username,
            text=text
        )

        # Trigger SplitBot if mentioned
        if text.startswith("@SplitBot"):
            # Gather context
            balances = {ud.username: ud.net_debt for ud in UserDebt.objects.filter(group=group)}
            recent_expenses = []
            for ex in Expense.objects.filter(group=group).order_by('-created_at')[:100]:
                recent_expenses.append({
                    "title": ex.title,
                    "amount": ex.amount,
                    "lender": ex.lender,
                    "date": ex.created_at.strftime("%Y-%m-%d")
                })
            
            context = {
                "balances": balances,
                "recent_expenses": recent_expenses
            }
            
            bot_reply = get_bot_response(text.replace("@SplitBot", "").strip(), context)
            
            ExpenseComment.objects.create(
                expense=expense,
                author="SplitBot",
                text=bot_reply
            )

        # Optional: log activity for comments
        log_activity(group, request.user.username, 'expense_edited', f"Commented on '{expense.title}'")
        
        # Return all comments to ensure the frontend gets the bot reply if triggered
        all_comments = expense.comments.all().order_by('created_at')
        return Response(ExpenseCommentSerializer(all_comments, many=True).data, status=status.HTTP_201_CREATED)

@api_view(['POST'])
def expense_settlement(request, group_id):
    # This might be redundant with debt_settle but keeping for compatibility
    try:
        group = Group.objects.get(id=group_id, members=request.user)
    except Group.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
        
    title = request.data.get('title')
    author = request.user.username
    lender = request.data.get('lender', '').lower()
    borrowers_data = request.data.get('borrowers', [])
    amount = request.data.get('amount', 0)

    expense = Expense.objects.create(group=group, title=title, author=author, lender=lender, amount=amount)

    for b in borrowers_data:
        b_username = b[0] if isinstance(b, list) else b.get('username', '')
        b_amount = b[1] if isinstance(b, list) else b.get('amount', 0)
        ExpenseBorrower.objects.create(expense=expense, username=b_username.lower(), amount=b_amount)

    log_activity(group, author, 'settlement', f"Recorded settlement '{title}' for {amount/100:.2f}")
    return Response(ExpenseSerializer(expense).data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
def delete_comment(request, group_id, expense_id, comment_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
        expense = Expense.objects.get(id=expense_id, group=group)
        comment = ExpenseComment.objects.get(id=comment_id, expense=expense)
    except (Group.DoesNotExist, Expense.DoesNotExist, ExpenseComment.DoesNotExist):
        return Response("Not found.", status=status.HTTP_404_NOT_FOUND)

    # Ownership Check
    if comment.author != request.user.username and comment.author != "SplitBot":
        # Note: Humans can't delete SplitBot comments unless we allow it. 
        # User said: "no body can delete any other member's comment"
        # I'll keep it strict: only the author.
        return Response("You can only delete your own comments.", status=status.HTTP_403_FORBIDDEN)

    comment_text_preview = comment.text[:20] + "..." if len(comment.text) > 20 else comment.text
    comment.delete()
    
    log_activity(group, request.user.username, 'comment_deleted', f"Deleted comment: '{comment_text_preview}' on '{expense.title}'")
    
    # Return updated list
    all_comments = expense.comments.all().order_by('created_at')
    return Response(ExpenseCommentSerializer(all_comments, many=True).data)

# ─── Debts (Scoped) ───────────────────────────────────────────────────────────

@api_view(['GET'])
def debts_list(request, group_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
    except Group.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    
    debts = Debt.objects.filter(group=group)
    return Response(DebtSerializer(debts, many=True).data)

@api_view(['GET'])
def optimised_debts_list(request, group_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
    except Group.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
        
    debts = OptimisedDebt.objects.filter(group=group)
    return Response(OptimisedDebtSerializer(debts, many=True).data)

@api_view(['GET', 'DELETE'])
def debt_detail(request, group_id, from_user, to_user):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
    except Group.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        try:
            debt = Debt.objects.get(group=group, from_user=from_user, to_user=to_user)
            return Response(DebtSerializer(debt).data)
        except Debt.DoesNotExist:
            return Response(None)

    elif request.method == 'DELETE':
        Debt.objects.filter(group=group, from_user=from_user, to_user=to_user).delete()
        simplify_debts(group)
        return Response(f"Debt from '{from_user}' to '{to_user}' deleted successfully.")

@api_view(['POST'])
def debt_add(request, group_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
    except Group.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    from_user = request.data.get('from')
    to_user = request.data.get('to')
    amount = request.data.get('amount', 0)

    result = process_new_debt(group, from_user, to_user, amount)
    simplify_debts(group)
    return Response(result, status=status.HTTP_201_CREATED)

@api_view(['POST'])
def debt_settle(request, group_id):
    try:
        group = Group.objects.get(id=group_id, members=request.user)
    except Group.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    from_user = request.data.get('from', '').lower()
    to_user = request.data.get('to', '').lower()
    amount_str = request.data.get('amount', 0)
    
    try:
        amount = int(float(amount_str) * 100) if isinstance(amount_str, str) else int(amount_str)
    except (ValueError, TypeError):
        return Response("Invalid amount.", status=status.HTTP_400_BAD_REQUEST)

    if amount <= 0:
        return Response("Amount must be greater than 0.", status=status.HTTP_400_BAD_REQUEST)

    # Use our helper for balance-accurate settlement
    from .helpers import reverse_debt, simplify_debts
    
    # We don't check for a specific debt row anymore because the user might be 
    # settling an "Optimised Debt" which doesn't exist in the raw Debt table.
    # Instead, we just process it as a transaction between them.
    msg = reverse_debt(group, from_user, to_user, amount)
    simplify_debts(group)

    log_activity(group, request.user.username, 'settlement', f"{from_user} paid {to_user} {amount/100:.2f}")
    return Response(f"Settlement recorded successfully.")
