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

SAAS = {
    "seed": 42,
    "resources": {
        "users": {"count": 10, "fields": {"id": "uuid", "name": "person", "email": "email"}},
        "projects": {"count": 5, "fields": {"id": "uuid", "name": "word", "owner_id": "ref(users.id)"}},
        "tasks": {"count": 30, "fields": {
            "id": "uuid", "title": "sentence", "project_id": "ref(projects.id)", "assignee_id": "ref(users.id)",
            "status": {"type": "enum", "values": ["todo", "in_progress", "done"]}
        }}
    }
}

BLOG = {
    "seed": 42,
    "resources": {
        "authors": {"count": 5, "fields": {"id": "uuid", "name": "person", "email": "email"}},
        "posts": {"count": 15, "fields": {"id": "uuid", "title": "sentence", "author_id": "ref(authors.id)", "published": "datetime"}},
        "comments": {"count": 40, "fields": {"id": "uuid", "post_id": "ref(posts.id)", "name": "person", "body": "sentence"}}
    }
}

ECOMMERCE = {
    "seed": 42,
    "resources": {
        "customers": {"count": 10, "fields": {"id": "uuid", "name": "person", "email": "email"}},
        "products": {"count": 20, "fields": {"id": "uuid", "name": "word", "price": "money"}},
        "orders": {"count": 30, "fields": {
            "id": "uuid", "customer_id": "ref(customers.id)", "product_id": "ref(products.id)",
            "amount": "money", "created": "datetime", "status": {"type": "enum", "values": ["placed", "shipped", "delivered"]}
        }}
    }
}

TEMPLATES = {"retail": RETAIL, "saas": SAAS, "blog": BLOG, "ecommerce": ECOMMERCE}
