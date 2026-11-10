from datetime import datetime
from decimal import Decimal
from math import ceil, floor

from faker import Faker

from model.schema import SchemaInput


def generate(schema: SchemaInput) -> dict[str, list[dict]]:
    fake = Faker(schema.locale)
    fake.seed_instance(schema.seed)
    generators = {
        "uuid": fake.uuid4,
        "person": fake.name,
        "email": fake.email,
        "date": lambda: fake.date_between_dates(date_start=datetime(2020, 1, 1), date_end=datetime(2025, 1, 1)).isoformat(),
        "datetime": lambda: fake.date_time_between_dates(datetime_start=datetime(2020, 1, 1), datetime_end=datetime(2025, 1, 1)).isoformat(),
        "money": lambda: fake.random_int(0, 1000000) / 100,
        "int": lambda: fake.random_int(0, 10000),
        "float": lambda: float(fake.pyfloat(left_digits=3, right_digits=4, positive=True)),
        "bool": fake.pybool,
        "sentence": fake.sentence,
        "word": fake.word,
    }
    def value(spec):
        if spec.min is not None or spec.max is not None:
            low, high = spec.numeric_bounds()
            if spec.type == 'int':
                return fake.random_int(int(low), int(high))
            if spec.type == 'money':
                return fake.random_int(ceil(Decimal(str(low)) * 100), floor(Decimal(str(high)) * 100)) / 100
            return fake.random.uniform(low, high)
        if spec.start is not None or spec.end is not None:
            low, high = spec.date_bounds()
            if spec.type == 'date':
                return fake.date_between_dates(date_start=low, date_end=high).isoformat()
            return fake.date_time_between_dates(datetime_start=low, datetime_end=high).isoformat()
        return fake.random_element(spec.values) if spec.type == 'enum' else generators[spec.type]()

    data = {name: [{} for _ in range(resource.count)] for name, resource in schema.resources.items()}
    pending = []
    for name, resource in schema.resources.items():
        for field, spec in resource.fields.items():
            if spec.type == "ref":
                pending.append((name, field, spec.target))
                continue
            for row in data[name]:
                row[field] = value(spec)
    while pending:
        remaining = []
        for name, field, target in pending:
            target_resource, target_field = target.split(".")
            if target_field not in data[target_resource][0]:
                remaining.append((name, field, target))
                continue
            values = [row[target_field] for row in data[target_resource]]
            for row in data[name]:
                row[field] = fake.random_element(values)
        pending = remaining
    return data
