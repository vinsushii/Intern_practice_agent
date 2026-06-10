from groq import Groq
from duckduckgo_search import DDGS
from google.colab import userdata
import time
from typing import List, Dict

client = Groq(api_key=userdata.get('GROQ_API_KEY')) # get actual api key from ipynb 
# https://colab.research.google.com/drive/1JWs2Lre4_37Sztn5kSJY-dQ_3YmknMGn?usp=chrome_ntp#scrollTo=l0MpvUCF03yo

# Function to search the web
def search_int(query: str) -> List[Dict]:
  try:
    with DDGS() as ddgs:
      result = list(ddgs.text(query, max_results=3))
      return result
  except Exception as e:
    return [{"body": f"Search error: {str(e)}"}]

# agent logic
def agent_logic(user_input: str) -> str:
  #define search keywords that the user may use
  keywords = [
      'search', 'find', 'look up','look for', 'give me',
      'what is', 'who is', 'where', 'when was',
      'update', 'latest', 'news', 'today','current','now'
  ]

#check keyword in user input
  search_for = any(keyword in user_input.lower()
    for keyword in keywords)

  try:
    if search_for:
      print("Searching...")
      search_result = search_int(user_input)

      format_result = []
      for result in search_result[:2]:
        if 'body' in result:
          format_result.append(f"- {result['body']}")

      context = "\n".join(format_result)

      prompt = f"""Based on this web search result, answer the user's question.

User question: {user_input}
Search results: {context}

Provide a helpful, accurate answer based on the search results.
If the search results don't contain relevant information, say so."""

    else:
       prompt = f"Answer this question helpfully and conversationally: {user_input}"

    #get LLM response

    comp = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user","content": prompt}],
        max_tokens=500
    )

    return comp.choices[0].message.content

  except Exception as e:
    return f"Error: {str(e)}\nPlease check your API key or try again."

# optional to suppress terminal warnings
"""
import warnings
warnings.filterwarnings('ignore', message='.*datetime.datetime.utcnow.*')
"""

# start chat
def start_chat():

  print("HELLO I AM A SEARCH AGENT CALLED PERRY THE PLATYPUS")
  print("="*10)

  print("\nCommands: ")
  print(" 'exit'")
  print("="*10 + "\n")

  chat_history = []

  while True:
    user_input = input('You: ')
    if user_input.lower() in ['exit']:
      print("\n BYE")
      break

    if not user_input:
      continue

    print("THINKING...")

    for _ in range(3):
      time.sleep(0.3)
      print(".", end="", flush= True)

    print("\n", end="")

    response = agent_logic(user_input)

    print(f"AGENT: {response}\n")

    chat_history.append({
        "user": user_input,
        "agent": response,
        "timestamp": time.time()
    })

if __name__ == "__main__":

    start_chat()
