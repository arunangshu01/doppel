import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request


def resource_router(name, rows, fields):
    routes = APIRouter(tags=[name])

    @routes.get(f"/{name}", name=f"list_{name}")
    def list_rows(request: Request, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=1000),
                  sort: str | None = None, order: Literal["asc", "desc"] = "asc"):
        filters = [(key, value) for key, value in request.query_params.multi_items() if key not in {"page", "limit", "sort", "order"}]
        if any(key not in fields for key, _ in filters) or (sort is not None and sort not in fields):
            raise HTTPException(400, "Unknown filter or sort field")
        result = rows
        for key, value in filters:
            result = [row for row in result if (json.dumps(row[key]) if isinstance(row[key], bool) else str(row[key])) == value]
        if sort:
            result = sorted(result, key=lambda row: row[sort], reverse=order == "desc")
        start = (page - 1) * limit
        return {"data": result[start:start + limit], "total": len(result), "page": page, "limit": limit}

    @routes.get(f"/{name}/{{id}}", name=f"get_{name}")
    def get_row(id: str):
        for row in rows:
            if row["id"] == id:
                return row
        raise HTTPException(404, "Record not found")

    return routes
