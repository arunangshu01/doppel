import re
from typing import Annotated

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

    @model_validator(mode="after")
    def validate_type(self):
        if self.type not in TYPES:
            raise ValueError(f"Unknown type: {self.type}")
        if self.type == "enum" and not self.values:
            raise ValueError("enum requires non-empty values")
        if self.type == "ref" and (not self.target or not re.fullmatch(rf"{NAME}\.{NAME}", self.target)):
            raise ValueError("ref requires a resource.field target")
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
