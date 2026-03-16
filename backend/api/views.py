from django.db.models import F
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
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

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
    }

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

            for group in user.expense_groups.all():
                log_activity(group, username, 'member_added', f"{username} changed a member : {username}")

            tokens = get_tokens_for_user(user)
            return Response({
                **tokens,
                'user': AuthUserSerializer(user).data
            }, status=status.HTTP_201_CREATED)

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name
    )
    tokens = get_tokens_for_user(user)
    return Response({
        **tokens,
        'user': AuthUserSerializer(user).data
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username', '').lower()
    password = request.data.get('password')
    user = authenticate(username=username, password=password)

    if user:
        tokens = get_tokens_for_user(user)
        return Response({
            **tokens,
            'user': AuthUserSerializer(user).data
        })
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
@permission_classes([AllowAny])
def google_login(request):
    """Authenticate with Google OAuth. Accepts either an ID token or user info from implicit flow."""
    import requests as http_requests

    credential = request.data.get('credential', '')
    email = request.data.get('email', '')
    first_name = request.data.get('given_name', '')
    last_name = request.data.get('family_name', '')

    # If we got an access token from implicit flow, verify it with Google
    if credential and not email:
        try:
            from google.oauth2 import id_token
            from google.auth.transport import requests as google_requests
            idinfo = id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                settings.GOOGLE_CLIENT_ID
            )
            email = idinfo.get('email', '')
            first_name = idinfo.get('given_name', first_name)
            last_name = idinfo.get('family_name', last_name)
        except ValueError:
            return Response({'error': 'Invalid Google token'}, status=status.HTTP_401_UNAUTHORIZED)

    # If email was sent directly (implicit flow with userinfo), verify the access token
    if credential and email:
        try:
            token_info = http_requests.get(
                f'https://oauth2.googleapis.com/tokeninfo?access_token={credential}'
            )
            if token_info.status_code != 200:
                return Response({'error': 'Invalid Google access token'}, status=status.HTTP_401_UNAUTHORIZED)
            token_data = token_info.json()
            if token_data.get('email') != email:
                return Response({'error': 'Email mismatch'}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception:
            return Response({'error': 'Could not verify Google token'}, status=status.HTTP_401_UNAUTHORIZED)

    if not email:
        return Response({'error': 'Email not provided'}, status=status.HTTP_400_BAD_REQUEST)

    # Try to find existing user by email or create one
    user = User.objects.filter(email=email).first()
    if not user:
        username = email.split('@')[0].lower()
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        user = User.objects.create_user(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
        )
        user.set_unusable_password()
        user.save()

    tokens = get_tokens_for_user(user)
    return Response({
        **tokens,
        'user': AuthUserSerializer(user).data
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def token_refresh(request):
    """Refresh an access token using a refresh token."""
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response({'error': 'Refresh token is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        refresh = RefreshToken(refresh_token)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        })
    except Exception:
        return Response({'error': 'Invalid or expired refresh token'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
def logout_view(request):
    try:
        refresh_token = request.data.get('refresh')
        if refresh_token:
            token = RefreshToken(refresh_token)
            token.blacklist()
    except Exception:
        pass
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

    username = request.data.get('username', '').strip()
    if not username:
        return Response({'error': 'Username is required'}, status=status.HTTP_400_BAD_REQUEST)

    user_to_add, created = User.objects.get_or_create(
        username=username,
        defaults={'first_name': username}
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


# ─── Invite Link ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def invite_info(request, invite_code):
    """Get group info from invite code. Returns group name and claimable (dummy) members."""
    try:
        group = Group.objects.get(invite_code=invite_code)
    except Group.DoesNotExist:
        return Response({'error': 'Invalid invite link'}, status=status.HTTP_404_NOT_FOUND)

    # Claimable members = users with unusable passwords (dummy accounts)
    claimable = []
    for member in group.members.all():
        claimable.append({
            'id': member.id,
            'username': member.username,
            'is_dummy': not member.has_usable_password(),
        })

    return Response({
        'group_id': group.id,
        'group_name': group.name,
        'invite_code': group.invite_code,
        'members': claimable,
    })

@api_view(['POST'])
def claim_member(request, invite_code):
    """Authenticated user claims a dummy member in the group."""
    try:
        group = Group.objects.get(invite_code=invite_code)
    except Group.DoesNotExist:
        return Response({'error': 'Invalid invite link'}, status=status.HTTP_404_NOT_FOUND)

    member_id = request.data.get('member_id')
    if not member_id:
        return Response({'error': 'member_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        dummy_user = User.objects.get(id=member_id)
    except User.DoesNotExist:
        return Response({'error': 'Member not found'}, status=status.HTTP_404_NOT_FOUND)

    if dummy_user not in group.members.all():
        return Response({'error': 'This user is not a member of this group'}, status=status.HTTP_400_BAD_REQUEST)

    if dummy_user.has_usable_password():
        return Response({'error': 'This member already has an account and cannot be claimed'}, status=status.HTTP_400_BAD_REQUEST)

    if request.user in group.members.all():
        return Response({'error': 'You are already a member of this group'}, status=status.HTTP_400_BAD_REQUEST)

    old_username = dummy_user.username
    new_username = request.user.username

    # Replace the dummy user with the authenticated user in the group
    group.members.remove(dummy_user)
    group.members.add(request.user)

    # Update all references from old username to new username
    # UserDebt
    UserDebt.objects.filter(group=group, username=old_username).update(username=new_username)
    # Debt
    Debt.objects.filter(group=group, from_user=old_username).update(from_user=new_username)
    Debt.objects.filter(group=group, to_user=old_username).update(to_user=new_username)
    # OptimisedDebt
    OptimisedDebt.objects.filter(group=group, from_user=old_username).update(from_user=new_username)
    OptimisedDebt.objects.filter(group=group, to_user=old_username).update(to_user=new_username)
    # Expenses
    Expense.objects.filter(group=group, author=old_username).update(author=new_username)
    Expense.objects.filter(group=group, lender=old_username).update(lender=new_username)
    # ExpenseLender & ExpenseBorrower (through expenses in this group)
    group_expense_ids = Expense.objects.filter(group=group).values_list('id', flat=True)
    ExpenseLender.objects.filter(expense_id__in=group_expense_ids, username=old_username).update(username=new_username)
    ExpenseBorrower.objects.filter(expense_id__in=group_expense_ids, username=old_username).update(username=new_username)
    # ExpenseComment
    ExpenseComment.objects.filter(expense_id__in=group_expense_ids, author=old_username).update(author=new_username)
    # ActivityLog
    ActivityLog.objects.filter(group=group, user=old_username).update(user=new_username)

    # Delete the dummy user if they're not in any other group
    if not dummy_user.expense_groups.exists():
        dummy_user.delete()

    log_activity(group, new_username, 'member_added', f"{new_username} claimed {old_username}'s spot via invite link")

    return Response({
        'message': f'Successfully joined as {new_username}',
        'group': GroupSerializer(group).data,
    })


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

    if comment.author != request.user.username and comment.author != "SplitBot":
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

    from .helpers import reverse_debt, simplify_debts

    msg = reverse_debt(group, from_user, to_user, amount)
    simplify_debts(group)

    log_activity(group, request.user.username, 'settlement', f"{from_user} paid {to_user} {amount/100:.2f}")
    return Response(f"Settlement recorded successfully.")
