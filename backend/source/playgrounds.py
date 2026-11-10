import asyncio
import secrets
import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException
from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse

from model.schema import SchemaInput
from routers.resources import resource_router
from source.engine import generate
from source.templates import RETAIL
from utility.settings import API_PREFIX


def cells(schema):
    return sum(resource.count * len(resource.fields) for resource in schema.resources.values())


@dataclass
class Dataset:
    schema: SchemaInput
    app: FastAPI
    manifest: dict
    deadline: float = float("inf")


def dataset(schema, base_path, session_id=None):
    data = generate(schema)
    app = FastAPI(title="doppel mock API", version="0.1.0")
    for name, rows in data.items():
        app.include_router(resource_router(name, rows, schema.resources[name].fields))
    manifest = {"seed": schema.seed, "base_path": base_path, "resources": [
        {"name": name, "count": len(rows), "endpoint": f"{base_path}/{name}"} for name, rows in data.items()
    ]}
    if session_id:
        manifest.update(id=session_id, expires_at=(datetime.now(timezone.utc) + timedelta(seconds=1800)).isoformat())
    return Dataset(schema, app, manifest, time.monotonic() + 1800 if session_id else float("inf"))


class PlaygroundStore:
    def __init__(self):
        self.demo = dataset(SchemaInput.model_validate(RETAIL), API_PREFIX)
        self.sessions = {}
        self.lock = asyncio.Lock()
        self.generations = deque()
        self.max_sessions = 20
        self.max_cells = 200000
        self.max_generations = 12

    def prune(self):
        now = time.monotonic()
        self.sessions = {key: value for key, value in self.sessions.items() if value.deadline > now}

    def get(self, session_id):
        self.prune()
        result = self.sessions.get(session_id)
        if result is None:
            raise HTTPException(404, "Playground expired or unavailable. Generate it again from your saved schema.")
        return result

    def budget(self):
        now = time.monotonic()
        while self.generations and self.generations[0] <= now - 60:
            self.generations.popleft()
        if len(self.generations) >= self.max_generations:
            raise HTTPException(429, "Generation capacity is temporarily busy. Retry shortly.", headers={"Retry-After": "60"})
        self.generations.append(now)

    async def save(self, schema, session_id=None, admin=False):
        async with self.lock:
            self.prune()
            previous = self.get(session_id) if session_id else None
            size = cells(schema)
            if not admin:
                if size > 20000:
                    raise HTTPException(422, "Visitor playgrounds are limited to 20000 cells.")
                used = sum(cells(item.schema) for item in self.sessions.values())
                if (not previous and len(self.sessions) >= self.max_sessions) or used - (cells(previous.schema) if previous else 0) + size > self.max_cells:
                    raise HTTPException(503, "Playground capacity is full. Try again after existing playgrounds expire.", headers={"Retry-After": "60"})
            self.budget()
            key = None if admin else session_id or secrets.token_urlsafe(24)
            base = API_PREFIX if admin else f"{API_PREFIX}/playgrounds/{key}"
            result = await run_in_threadpool(dataset, schema, base, key)
            if admin:
                self.demo = result
            else:
                if previous:
                    result.deadline = previous.deadline
                    result.manifest["expires_at"] = previous.manifest["expires_at"]
                self.sessions[key] = result
            return result.manifest


class DatasetGateway:
    def __init__(self, store, visitors=False):
        self.store = store
        self.visitors = visitors

    async def __call__(self, scope, receive, send):
        target = self.store.demo
        if self.visitors:
            relative = scope["path"][len(scope.get("root_path", "")):]
            session_id = relative.lstrip("/").split("/", 1)[0]
            try:
                target = self.store.get(session_id)
            except HTTPException as exc:
                await JSONResponse({"detail": exc.detail}, status_code=exc.status_code)(scope, receive, send)
                return
            scope = {**scope, "root_path": scope.get("root_path", "") + "/" + session_id}
        await target.app(scope, receive, send)
