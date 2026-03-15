import heapq
from .models import Debt, UserDebt, OptimisedDebt

def reverse_debt(group, from_user, to_user, amount):
    # Step 1: Reverse the aggregate net debts
    from_ud, _ = UserDebt.objects.get_or_create(group=group, username=from_user, defaults={'net_debt': 0})
    to_ud, _ = UserDebt.objects.get_or_create(group=group, username=to_user, defaults={'net_debt': 0})

    from_ud.net_debt -= amount
    from_ud.save()
    to_ud.net_debt += amount
    to_ud.save()

    # Step 2: Reverse the pairwise debt
    debt_amount = amount
    try:
        existing = Debt.objects.get(group=group, from_user=from_user, to_user=to_user)
        if existing.amount > debt_amount:
            existing.amount -= debt_amount
            existing.save()
            return "Debt reduced"
        else:
            debt_amount -= existing.amount
            existing.delete()
    except Debt.DoesNotExist:
        pass

    # If there's remaining amount, create reverse debt
    if debt_amount > 0:
        try:
            reverse = Debt.objects.get(group=group, from_user=to_user, to_user=from_user)
            reverse.amount += debt_amount
            reverse.save()
            return "Reverse debt increased"
        except Debt.DoesNotExist:
            Debt.objects.create(group=group, from_user=to_user, to_user=from_user, amount=debt_amount)
            return "Reverse debt created"

    return "Debt reversed"

def process_new_debt(group, from_user, to_user, amount):
    # Step 1: Update aggregate net debts
    from_ud, _ = UserDebt.objects.get_or_create(group=group, username=from_user, defaults={'net_debt': 0})
    to_ud, _ = UserDebt.objects.get_or_create(group=group, username=to_user, defaults={'net_debt': 0})

    from_ud.net_debt += amount
    from_ud.save()
    to_ud.net_debt -= amount
    to_ud.save()

    # Step 2: Check for reverse debt
    debt_amount = amount
    try:
        reverse_debt = Debt.objects.get(group=group, from_user=to_user, to_user=from_user)
        if reverse_debt.amount > debt_amount:
            # Reverse debt absorbs new debt entirely
            reverse_debt.amount -= debt_amount
            reverse_debt.save()
            return "Cancelled by reverse debt"
        else:
            # New debt absorbs reverse debt
            debt_amount -= reverse_debt.amount
            reverse_debt.delete()
    except Debt.DoesNotExist:
        pass

    # Step 3: Create or update remaining debt
    if debt_amount > 0:
        try:
            existing = Debt.objects.get(group=group, from_user=from_user, to_user=to_user)
            existing.amount += debt_amount
            existing.save()
            return "Debt updated"
        except Debt.DoesNotExist:
            Debt.objects.create(group=group, from_user=from_user, to_user=to_user, amount=debt_amount)
            return "Debt created"

    return "No new debt needed"

def process_multi_payer_debt(group, lenders_data, borrowers_data, total_amount):
    """
    lenders_data: list of (username, amount)
    borrowers_data: list of (username, amount)
    """
    # 1. Update UserDebt for all involved
    for l_username, l_amount in lenders_data:
        ud, _ = UserDebt.objects.get_or_create(group=group, username=l_username, defaults={'net_debt': 0})
        ud.net_debt -= l_amount
        ud.save()
    
    for b_username, b_amount in borrowers_data:
        ud, _ = UserDebt.objects.get_or_create(group=group, username=b_username, defaults={'net_debt': 0})
        ud.net_debt += b_amount
        ud.save()

    # 2. Update pairwise Debt (proportional distribution)
    # Each borrower owes each lender: borrower_amt * (lender_amt / total)
    for b_username, b_amount in borrowers_data:
        for l_username, l_amount in lenders_data:
            if b_username == l_username:
                continue # Can't owe yourself
            
            # Use floating point for precision then round to cents
            pair_amount = round(b_amount * (l_amount / total_amount))
            if pair_amount > 0:
                # We reuse process_new_debt but ONLY the Debt table part
                # Actually, let's just do it manually here to avoid double-counting UserDebt
                _add_pairwise_debt(group, b_username, l_username, pair_amount)

def reverse_multi_payer_debt(group, lenders_data, borrowers_data, total_amount):
    # 1. Reverse UserDebt
    for l_username, l_amount in lenders_data:
        ud, _ = UserDebt.objects.get_or_create(group=group, username=l_username, defaults={'net_debt': 0})
        ud.net_debt += l_amount
        ud.save()
    
    for b_username, b_amount in borrowers_data:
        ud, _ = UserDebt.objects.get_or_create(group=group, username=b_username, defaults={'net_debt': 0})
        ud.net_debt -= b_amount
        ud.save()

    # 2. Reverse pairwise Debt
    for b_username, b_amount in borrowers_data:
        for l_username, l_amount in lenders_data:
            if b_username == l_username:
                continue
            
            pair_amount = round(b_amount * (l_amount / total_amount))
            if pair_amount > 0:
                _reverse_pairwise_debt(group, b_username, l_username, pair_amount)

def _add_pairwise_debt(group, from_user, to_user, amount):
    # This is Step 2 & 3 of process_new_debt but isolated
    debt_amount = amount
    try:
        reverse = Debt.objects.get(group=group, from_user=to_user, to_user=from_user)
        if reverse.amount > debt_amount:
            reverse.amount -= debt_amount
            reverse.save()
            return
        else:
            debt_amount -= reverse.amount
            reverse.delete()
    except Debt.DoesNotExist:
        pass

    if debt_amount > 0:
        existing, created = Debt.objects.get_or_create(
            group=group, from_user=from_user, to_user=to_user, 
            defaults={'amount': 0}
        )
        existing.amount += debt_amount
        existing.save()

def _reverse_pairwise_debt(group, from_user, to_user, amount):
    # This is Step 2 of reverse_debt but isolated
    debt_amount = amount
    try:
        existing = Debt.objects.get(group=group, from_user=from_user, to_user=to_user)
        if existing.amount > debt_amount:
            existing.amount -= debt_amount
            existing.save()
            return
        else:
            debt_amount -= existing.amount
            existing.delete()
    except Debt.DoesNotExist:
        pass

    if debt_amount > 0:
        reverse, created = Debt.objects.get_or_create(
            group=group, from_user=to_user, to_user=from_user,
            defaults={'amount': 0}
        )
        reverse.amount += debt_amount
        reverse.save()

def simplify_debts(group):
    # Get all user debts for this group
    all_user_debts = UserDebt.objects.filter(group=group)

    debtors = []
    creditors = []

    for ud in all_user_debts:
        if ud.net_debt > 0:
            heapq.heappush(debtors, (ud.net_debt, ud.username))
        elif ud.net_debt < 0:
            heapq.heappush(creditors, (-ud.net_debt, ud.username))

    # Clear existing optimised debts for this group
    OptimisedDebt.objects.filter(group=group).delete()

    while debtors and creditors:
        debt_amount, debtor = heapq.heappop(debtors)
        credit_amount, creditor = heapq.heappop(creditors)

        transaction = min(debt_amount, credit_amount)

        OptimisedDebt.objects.create(
            group=group,
            from_user=debtor,
            to_user=creditor,
            amount=transaction
        )

        debtor_remainder = debt_amount - transaction
        creditor_remainder = credit_amount - transaction

        if debtor_remainder > 0:
            heapq.heappush(debtors, (debtor_remainder, debtor))
        if creditor_remainder > 0:
            heapq.heappush(creditors, (creditor_remainder, creditor))

