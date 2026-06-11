from fastmcp import FastMCP
import json
from pathlib import Path

mcp = FastMCP("ShoppingAssistantMCP")

BASE_DIR = Path(__file__).parent

def load_json(filename):
    with open(BASE_DIR / filename) as f:
        return json.load(f)

@mcp.tool()
def search_products(query: str, max_results: int = 10) -> list[dict]:
    """Search the product catalog by keyword (matches product name)."""
    catalog = load_json("catalog.json")
    q = query.lower()
    matches = [p for p in catalog if q in p["name"].lower()]
    return matches[:max_results]

@mcp.tool()
def compare_products(product_ids: list[int]) -> list[dict]:
    """Compare products by their IDs, returning price, stock, and category side-by-side."""
    catalog = load_json("catalog.json")
    return [p for p in catalog if p["id"] in product_ids]

@mcp.tool()
def check_seller(seller_id: str) -> dict:
    """Check a seller's legitimacy by ID: returns rating, years active, and complaint count."""
    sellers = load_json("sellers.json")
    return sellers.get(seller_id, {"error": "Seller not found"})

@mcp.tool()
def get_reviews(product_id: int) -> dict:
    """Get customer reviews and average rating for a product by ID."""
    reviews_data = load_json("reviews.json")
    entry = next((r for r in reviews_data if r["product_id"] == product_id), None)
    if not entry:
        return {"product_id": product_id, "average_rating": None, "reviews": []}
    avg = sum(r["rating"] for r in entry["reviews"]) / len(entry["reviews"])
    return {"product_id": product_id, "average_rating": round(avg, 1), "reviews": entry["reviews"]}

@mcp.resource("catalog://{category}")
def get_category(category: str) -> str:
    """Returns products in a given category as JSON."""
    catalog = load_json("catalog.json")
    products = [p for p in catalog if p.get("category", "").lower() == category.lower()]
    return json.dumps({"category": category, "products": products})

if __name__ == "__main__":
    mcp.run(transport="http", host="127.0.0.1", port=8000)