from datetime import datetime

from faker import Faker

from model.schema import SchemaInput


def generate(schema: SchemaInput) -> dict[str, list[dict]]:
    fake = Faker("en_US")
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
    data = {name: [{} for _ in range(resource.count)] for name, resource in schema.resources.items()}
    pending = []
    for name, resource in schema.resources.items():
        for field, spec in resource.fields.items():
            if spec.type == "ref":
                pending.append((name, field, spec.target))
                continue
            for row in data[name]:
                row[field] = fake.random_element(spec.values) if spec.type == "enum" else generators[spec.type]()
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
