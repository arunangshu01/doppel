import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.playground import router
from source.playgrounds import DatasetGateway, PlaygroundStore
from utility.http import APIGuards
from utility.settings import ADMIN_TOKEN, API_PREFIX, CORS_ORIGINS, HOST, PORT


def create_app(admin_token=None):
    app = FastAPI(title="doppel", version="0.1.0", openapi_url=None, docs_url=None, redoc_url=None)
    app.state.admin_token = ADMIN_TOKEN if admin_token is None else admin_token
    app.state.store = PlaygroundStore()
    app.include_router(router, prefix=API_PREFIX)
    app.mount(f"{API_PREFIX}/playgrounds", DatasetGateway(app.state.store, visitors=True))
    app.mount(API_PREFIX, DatasetGateway(app.state.store))
    app.add_middleware(APIGuards)
    app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_methods=["GET", "POST", "PUT"], allow_headers=["Content-Type", "Authorization"])
    return app


app = create_app()

if __name__ == "__main__":
    uvicorn.run("app.main:app", host=HOST, port=PORT, access_log=False)
