import re
from datetime import date, datetime
from decimal import Decimal
from math import ceil, floor
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


TYPES = {"uuid", "person", "email", "date", "datetime", "money", "int", "float", "bool", "enum", "sentence", "word", "ref"}
NAME = r"[a-z][a-z0-9_]{0,47}"
REFERENCE = re.compile(rf"ref\(({NAME})\.({NAME})\)")
RESERVED = {"api", "docs", "redoc", "openapi", "health", "schema", "templates", "playgrounds", "demo"}
QUERY_FIELDS = {"page", "limit", "sort", "order"}


class FieldSpec(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: str
    values: list[Annotated[str, StringConstraints(max_length=128)]] = Field(default_factory=list, max_length=100)
    target: str | None = None
    min: float | None = Field(default=None, ge=-1e9, le=1e9, allow_inf_nan=False, strict=True)
    max: float | None = Field(default=None, ge=-1e9, le=1e9, allow_inf_nan=False, strict=True)
    start: str | None = Field(default=None, min_length=1, max_length=32)
    end: str | None = Field(default=None, min_length=1, max_length=32)

    def numeric_bounds(self):
        return self.min if self.min is not None else 0, self.max if self.max is not None else 10000

    def date_bounds(self):
        parse = date.fromisoformat if self.type == 'date' else datetime.fromisoformat
        return parse(self.start or '2020-01-01'), parse(self.end or '2025-01-01')

    @model_validator(mode="after")
    def validate_type(self):
        if self.type not in TYPES:
            raise ValueError(f"Unknown type: {self.type}")
        if self.type == "enum" and not self.values:
            raise ValueError("enum requires non-empty values")
        if self.type == "ref" and (not self.target or not re.fullmatch(rf"{NAME}\.{NAME}", self.target)):
            raise ValueError("ref requires a resource.field target")
        if self.min is not None or self.max is not None:
            if self.type not in {'int', 'float', 'money'}:
                raise ValueError('min/max require an int, float, or money field')
            low, high = self.numeric_bounds()
            if low > high:
                raise ValueError('min must not exceed max')
            if self.type == 'int' and any(value != int(value) for value in (low, high)):
                raise ValueError('int bounds must be whole numbers')
            if self.type == 'money' and (low < 0 or ceil(Decimal(str(low)) * 100) > floor(Decimal(str(high)) * 100)):
                raise ValueError('money bounds must contain a non-negative whole-cent value')
        if self.start is not None or self.end is not None:
            if self.type not in {'date', 'datetime'}:
                raise ValueError('start/end require a date or datetime field')
            low, high = self.date_bounds()
            if self.type == 'datetime' and (low.tzinfo is not None or high.tzinfo is not None or low.microsecond or high.microsecond):
                raise ValueError('datetime bounds must use timezone-free ISO values at whole-second precision')
            if low > high or low.year < 1900 or high.year > 2100:
                raise ValueError('date bounds must be ordered and within 1900 through 2100')
        return self


def field_spec(value):
    if isinstance(value, str):
        match = REFERENCE.fullmatch(value)
        return FieldSpec(type="ref", target=".".join(match.groups())) if match else FieldSpec(type=value)
    return FieldSpec.model_validate(value)


class Resource(BaseModel):
    model_config = ConfigDict(extra="forbid")
    count: int = Field(default=20, ge=1, le=1000, strict=True)
    fields: dict[str, str | FieldSpec] = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def validate_fields(self):
        for name, spec in self.fields.items():
            if not re.fullmatch(NAME, name) or name in QUERY_FIELDS:
                raise ValueError(f"Invalid or reserved field name: {name}")
            self.fields[name] = field_spec(spec)
        if "id" not in self.fields or self.fields["id"].type != "uuid":
            raise ValueError("Every resource requires an id field of type uuid")
        return self


class SchemaInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    seed: int = Field(default=42, ge=0, le=2**32 - 1, strict=True)
    locale: Literal['en_US', 'en_IN', 'en_GB', 'fr_FR', 'de_DE'] = 'en_US'
    resources: dict[str, Resource] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def validate_references(self):
        if sum(resource.count * len(resource.fields) for resource in self.resources.values()) > 100000:
            raise ValueError("Schema exceeds the 100000 cell limit")
        for name in self.resources:
            if not re.fullmatch(NAME, name) or name in RESERVED:
                raise ValueError(f"Invalid or reserved resource name: {name}")
        for resource in self.resources.values():
            for spec in resource.fields.values():
                seen = set()
                while spec.type == "ref":
                    if spec.target in seen:
                        raise ValueError("Reference cycle has no concrete target")
                    seen.add(spec.target)
                    name, field = spec.target.split(".")
                    if name not in self.resources or field not in self.resources[name].fields:
                        raise ValueError(f"Unknown reference: {spec.target}")
                    spec = self.resources[name].fields[field]
        return self
