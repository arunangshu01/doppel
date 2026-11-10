import secrets

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from model.schema import SchemaInput
from source.templates import TEMPLATES

router = APIRouter(tags=["Playground"])


def authorize_admin(request: Request, authorization: str = Header(default="")):
    token = request.app.state.admin_token
    if not token:
        raise HTTPException(503, "Admin publishing is disabled on this server.")
    if not secrets.compare_digest(authorization.encode(), f"Bearer {token}".encode()):
        raise HTTPException(401, "Admin authorization required", headers={"WWW-Authenticate": "Bearer"})


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/templates")
def templates():
    return {"templates": [{"id": name, "resources": list(schema["resources"])} for name, schema in TEMPLATES.items()]}


@router.get("/templates/{name}")
def get_template(name: str):
    if name not in TEMPLATES:
        raise HTTPException(404, "Unknown starter template")
    return TEMPLATES[name]


@router.get("/schema")
def get_schema(request: Request):
    return request.app.state.store.demo.schema.model_dump()


@router.get("/demo")
def demo(request: Request):
    data = request.app.state.store.demo
    return {**data.manifest, "schema": data.schema.model_dump()}


@router.post("/schema", dependencies=[Depends(authorize_admin)])
async def set_schema(schema: SchemaInput, request: Request):
    return await request.app.state.store.save(schema, admin=True)


@router.post("/playgrounds", status_code=201)
async def create_playground(schema: SchemaInput, request: Request):
    return await request.app.state.store.save(schema)


@router.get("/playgrounds/{session_id}")
async def get_playground(session_id: str, request: Request):
    return request.app.state.store.get(session_id).manifest


@router.get("/playgrounds/{session_id}/schema")
async def get_playground_schema(session_id: str, request: Request):
    return request.app.state.store.get(session_id).schema.model_dump()


@router.put("/playgrounds/{session_id}")
async def update_playground(session_id: str, schema: SchemaInput, request: Request):
    return await request.app.state.store.save(schema, session_id)
