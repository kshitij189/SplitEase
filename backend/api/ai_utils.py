import os
import google.generativeai as genai
from dotenv import load_dotenv
from pathlib import Path

# Get absolute path to .env file
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("GEMINI_API_KEY not found in environment!")
else:
    print(f"GEMINI_API_KEY loaded successfully (starts with {api_key[:5]}...)")

genai.configure(api_key=api_key)

def get_bot_response(user_query, context_data):
    """
    Sends a query to Gemini with group context and returns the response.
    """
    if not api_key:
        return "I need a Gemini API Key to work! Please add GEMINI_API_KEY to your .env file."

    model = genai.GenerativeModel('gemini-2.5-flash')
    
    system_prompt = f"""
    You are 'SplitBot', a helpful and concise financial assistant for SplitEase, a bill-splitting app.
    Your job is to answer questions about the group's expenses and debts based on the provided data.
    
    ### Group Financial Context:
    - Members & Balances: {context_data['balances']}
    - Recent Expenses: {context_data['recent_expenses']}
    
    ### Smart Settlement Algorithm Knowledge:
    - We use a 'Greedy Transaction Minimization Algorithm' to simplify group debts.
    - Algorithm Complexity: O(n log n).
    - Goal: Minimize the total number of transactions required to settle all debts.
    - How it works: Instead of Alice paying Bob and Bob paying Charlie, the algorithm suggests Alice pays Charlie directly.
    - It uses 'User Balances' (net debt) to calculate the most efficient payment paths.
    
    ### Rules:
    1. Be concise and friendly.
    2. Use emojis to make the conversation lively.
    3. If the user asks who owes most, look at the balances (negative means they owe money).
    4. If the user asks about specific spending, look at the recent expenses.
    5. If the user asks how settlements are calculated or what 'Smart Split' is, explain the Greedy Algorithm and transaction minimization as described above.
    6. If you cannot find the answer in the context, say so politely.
    7. All amounts are in cents in the backend (e.g. 1000 = ₹10.00). Convert them to ₹ format in your response.
    8. Always refer to users by their usernames as provided.
    """
    
    try:
        chat = model.start_chat(history=[])
        response = chat.send_message(f"{system_prompt}\n\nUser Question: {user_query}")
        return response.text.strip()
    except Exception as e:
        error_msg = f"Error calling Gemini: {str(e)}"
        print(error_msg)
        return f"Oops! I encountered a technical glitch while thinking: {str(e)}"

