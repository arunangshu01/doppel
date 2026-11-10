from datetime import date, datetime
from uuid import UUID

import pytest
from pydantic import ValidationError

from model.schema import SchemaInput
from source.engine import generate
from source.templates import RETAIL


def test_seeded_types_and_relationships():
    schema = SchemaInput.model_validate({"seed": 42, "resources": {
        "orders": {"count": 12, "fields": {"id": "uuid", "user_id": "ref(users.id)", "amount": "money"}},
        "users": {"count": 4, "fields": {
            "id": "uuid", "name": "person", "email": "email", "born": "date",
            "created": "datetime", "age": "int", "score": "float", "active": "bool",
            "status": {"type": "enum", "values": ["new", "active"]}, "bio": "sentence", "tag": "word"
        }}
    }})
    data = generate(schema)
    assert data == generate(schema)
    assert data != generate(schema.model_copy(update={"seed": 43}))
    ids = {row["id"] for row in data["users"]}
    assert len(ids) == 4
    assert all(row["user_id"] in ids for row in data["orders"])
    user = data["users"][0]
    UUID(user["id"])
    date.fromisoformat(user["born"])
    datetime.fromisoformat(user["created"])
    assert "@" in user["email"]
    assert isinstance(user["age"], int)
    assert isinstance(user["score"], float)
    assert isinstance(user["active"], bool)
    assert user["status"] in ["new", "active"]
    assert all(row["amount"] >= 0 for row in data["orders"])


def test_retail_template():
    data = generate(SchemaInput.model_validate(RETAIL))
    assert set(data) == {"stores", "skus", "transactions"}
    assert all(row["store_id"] in {s["id"] for s in data["stores"]} for row in data["transactions"])
    assert all(row["sku_id"] in {s["id"] for s in data["skus"]} for row in data["transactions"])


@pytest.mark.parametrize("resources", [
    {},
    {"docs": {"fields": {"id": "uuid"}}},
    {"users": {"fields": {"name": "person"}}},
    {"users": {"fields": {"id": "uuid", "bad": "unknown"}}},
    {"users": {"fields": {"id": "uuid", "bad": "enum"}}},
    {"users": {"fields": {"id": "uuid", "bad": "ref(missing.id)"}}},
    {"users": {"fields": {"id": "uuid", "bad": "ref(users.bad)"}}},
    {"users": {"count": 1001, "fields": {"id": "uuid"}}},
    {"users": {"fields": {"id": "int"}}},
])
def test_invalid_schemas(resources):
    with pytest.raises(ValidationError):
        SchemaInput.model_validate({"resources": resources})


def test_cyclic_and_self_references_resolve_at_field_level():
    schema = SchemaInput.model_validate({"resources": {
        "a": {"fields": {"id": "uuid", "b_id": "ref(b.id)", "parent": "ref(a.id)"}},
        "b": {"fields": {"id": "uuid", "a_id": "ref(a.id)"}}
    }})
    assert generate(schema)["a"][0]["b_id"]


def test_reference_cycles_without_concrete_target_rejected():
    with pytest.raises(ValidationError):
        SchemaInput.model_validate({"resources": {"a": {"fields": {
            "id": "uuid", "x": "ref(a.y)", "y": "ref(a.x)"
        }}}})
