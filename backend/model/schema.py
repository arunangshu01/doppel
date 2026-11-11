import re
from datetime import date, datetime
from decimal import Decimal
from math import ceil, floor
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_serializer, model_validator


TYPES = {"uuid", "person", "email", "date", "datetime", "money", "int", "float", "bool", "enum", "sentence", "word", "ref"}
NAME = r"[a-z][a-z0-9_]{0,47}"
REFERENCE = re.compile(rf"ref\(({NAME})\.({NAME})\)")
RESERVED = {"api", "docs", "redoc", "openapi", "health", "schema", "templates", "playgrounds", "demo"}
QUERY_FIELDS = {"page", "limit", "sort", "order"}
NUMERIC_SPAN = 10000
DATE_LIMITS = {"date": (date(1900, 1, 1), date(2100, 12, 31)), "datetime": (datetime(1900, 1, 1), datetime(2100, 12, 31, 23, 59, 59))}


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
        low, high = self.min, self.max
        if low is None:
            low = 0 if high is None or high >= 0 else high - NUMERIC_SPAN
        if high is None:
            high = NUMERIC_SPAN if low <= NUMERIC_SPAN else low + NUMERIC_SPAN
        return low, high

    def parse_date(self, value):
        return (date.fromisoformat if self.type == 'date' else datetime.fromisoformat)(value)

    def date_bounds(self):
        default_low, default_high = self.parse_date('2020-01-01'), self.parse_date('2025-01-01')
        floor_, ceiling = DATE_LIMITS[self.type]
        low = self.parse_date(self.start) if self.start is not None else None
        high = self.parse_date(self.end) if self.end is not None else None
        if low is None:
            low = default_low if high is None or high >= default_low else max(high - (default_high - default_low), floor_)
        if high is None:
            high = default_high if low <= default_high else min(low + (default_high - default_low), ceiling)
        return low, high

    @model_serializer(mode="wrap")
    def compact(self, handler):
        data = {key: value for key, value in handler(self).items() if key == "type" or value not in (None, [])}
        if data.keys() == {"type"}:
            return self.type
        return f"ref({self.target})" if data.keys() == {"type", "target"} and self.type == "ref" else data

    @model_validator(mode="after")
    def validate_type(self):
        if self.type not in TYPES:
            raise ValueError(f"Unknown type: {self.type}")
        if self.type == "enum" and not self.values:
            raise ValueError("enum requires non-empty values")
        if self.values and self.type != "enum":
            raise ValueError("values require an enum field")
        if self.type == "ref" and (not self.target or not re.fullmatch(rf"{NAME}\.{NAME}", self.target)):
            raise ValueError("ref requires a resource.field target")
        if self.target is not None and self.type != "ref":
            raise ValueError("target requires a ref field")
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
            given = [self.parse_date(value) for value in (self.start, self.end) if value is not None]
            if self.type == 'datetime' and any(value.tzinfo is not None or value.microsecond for value in given):
                raise ValueError('datetime bounds must use timezone-free ISO values at whole-second precision')
            if any(value.year < 1900 or value.year > 2100 for value in given):
                raise ValueError('date bounds must be ordered and within 1900 through 2100')
            low, high = self.date_bounds()
            if low > high:
                raise ValueError('date bounds must be ordered and within 1900 through 2100')
        return self


class Resource(BaseModel):
    model_config = ConfigDict(extra="forbid")
    count: int = Field(default=20, ge=1, le=1000, strict=True)
    fields: dict[str, FieldSpec] = Field(min_length=1, max_length=50)

    @field_validator("fields", mode="before")
    @classmethod
    def expand_shorthand(cls, fields):
        if not isinstance(fields, dict):
            return fields
        expanded = {}
        for name, spec in fields.items():
            if isinstance(spec, str):
                match = REFERENCE.fullmatch(spec)
                spec = {"type": "ref", "target": ".".join(match.groups())} if match else {"type": spec}
            expanded[name] = spec
        return expanded

    @model_validator(mode="after")
    def validate_fields(self):
        for name in self.fields:
            if not re.fullmatch(NAME, name) or name in QUERY_FIELDS:
                raise ValueError(f"Invalid or reserved field name: {name}")
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
