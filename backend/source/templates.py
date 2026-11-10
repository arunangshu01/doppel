RETAIL = {
    "seed": 42,
    "resources": {
        "stores": {"count": 5, "fields": {
            "id": "uuid", "name": "word", "manager": "person", "email": "email"
        }},
        "skus": {"count": 30, "fields": {
            "id": "uuid", "name": "word", "description": "sentence", "price": "money",
            "category": {"type": "enum", "values": ["grocery", "home", "clothing", "electronics"]}
        }},
        "transactions": {"count": 100, "fields": {
            "id": "uuid", "store_id": "ref(stores.id)", "sku_id": "ref(skus.id)",
            "amount": "money", "created": "datetime",
            "status": {"type": "enum", "values": ["completed", "pending", "refunded"]}
        }}
    }
}
