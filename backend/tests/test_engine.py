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


def test_locale_and_numeric_date_constraints_are_deterministic():
    schema = SchemaInput.model_validate({"seed": 5, "locale": "en_IN", "resources": {"people": {"count": 30, "fields": {
        "id": "uuid", "name": "person", "age": {"type": "int", "min": 18, "max": 21},
        "price": {"type": "money", "min": 1.25, "max": 2.50},
        "score": {"type": "float", "min": -2.5, "max": 2.5},
        "born": {"type": "date", "start": "2000-01-01", "end": "2000-01-03"},
        "created": {"type": "datetime", "start": "2024-01-01T00:00:00", "end": "2024-01-01T00:00:01"}
    }}}})
    data = generate(schema)
    assert data == generate(schema)
    for row in data['people']:
        assert 18 <= row['age'] <= 21
        assert 1.25 <= row['price'] <= 2.5
        assert -2.5 <= row['score'] <= 2.5
        assert '2000-01-01' <= row['born'] <= '2000-01-03'
        assert '2024-01-01T00:00:00' <= row['created'] <= '2024-01-01T00:00:01'


@pytest.mark.parametrize('field', [
    {'type': 'int', 'min': 2, 'max': 1}, {'type': 'int', 'min': 1.5},
    {'type': 'float', 'min': float('inf')}, {'type': 'money', 'min': -1},
    {'type': 'word', 'min': 1}, {'type': 'date', 'start': 'bad'},
    {'type': 'date', 'start': ''},
    {'type': 'date', 'start': '2025-01-01', 'end': '2020-01-01'},
    {'type': 'datetime', 'start': '2020-01-01T00:00:00+01:00'},
    {'type': 'datetime', 'start': '2020-01-01T00:00:00.500000'},
    {'type': 'int', 'min': True}, {'type': 'money', 'min': 1.231, 'max': 1.239},
])
def test_invalid_constraints_rejected(field):
    with pytest.raises(ValidationError):
        SchemaInput.model_validate({'resources': {'items': {'fields': {'id': 'uuid', 'value': field}}}})


def test_equal_bounds_and_exact_cent_values():
    schema = SchemaInput.model_validate({'resources': {'items': {'count': 3, 'fields': {
        'id': 'uuid', 'quantity': {'type': 'int', 'min': -3, 'max': -3},
        'price': {'type': 'money', 'min': 1.15, 'max': 1.15},
        'score': {'type': 'float', 'min': 0, 'max': 0},
        'day': {'type': 'date', 'start': '2000-02-29', 'end': '2000-02-29'},
        'instant': {'type': 'datetime', 'start': '2024-01-01T12:00:00', 'end': '2024-01-01T12:00:00'}
    }}}})
    for row in generate(schema)['items']:
        assert row['quantity'] == -3 and row['price'] == 1.15 and row['score'] == 0
        assert row['day'] == '2000-02-29' and row['instant'] == '2024-01-01T12:00:00'


def test_unknown_locale_rejected():
    with pytest.raises(ValidationError):
        SchemaInput.model_validate({'locale': 'missing_locale', 'resources': {'items': {'fields': {'id': 'uuid'}}}})


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
