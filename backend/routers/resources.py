import asyncio
import json
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import JSONResponse


async def simulate(request, delay_ms, status):
    if delay_ms:
        budget = request.scope['doppel_store']
        active = budget.simulation_requests
        if active >= 4:
            raise HTTPException(429, 'Simulated delay capacity reached. Retry shortly.', headers={'Retry-After': '1'})
        budget.simulation_requests = active + 1
        try:
            await asyncio.sleep(delay_ms / 1000)
        finally:
            budget.simulation_requests -= 1
    if status != '200':
        return JSONResponse({'detail': f'Simulated HTTP {status} response', 'simulated': True}, status_code=int(status),
                            headers={'X-Doppel-Simulated': 'true'})


def resource_router(name, rows, fields):
    routes = APIRouter(tags=[name])

    @routes.get(f"/{name}", name=f"list_{name}")
    async def list_rows(request: Request, page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=1000),
                        sort: str | None = None, order: Literal["asc", "desc"] = "asc",
                        delay_ms: int = Query(0, ge=0, le=3000, alias='_delay_ms'),
                        status: Literal['200', '400', '401', '403', '404', '429', '500', '503'] = Query('200', alias='_status'),
                        empty: bool = Query(False, alias='_empty')):
        filters = [(key, value) for key, value in request.query_params.multi_items()
                   if key not in {"page", "limit", "sort", "order", '_delay_ms', '_status', '_empty'}]
        if any(key not in fields for key, _ in filters) or (sort is not None and sort not in fields):
            raise HTTPException(400, "Unknown filter or sort field")
        simulated = await simulate(request, delay_ms, status)
        if simulated is not None:
            return simulated
        result = [] if empty else rows
        for key, value in filters:
            result = [row for row in result if (json.dumps(row[key]) if isinstance(row[key], bool) else str(row[key])) == value]
        if sort:
            result = sorted(result, key=lambda row: row[sort], reverse=order == "desc")
        start = (page - 1) * limit
        return {"data": result[start:start + limit], "total": len(result), "page": page, "limit": limit}

    @routes.get(f"/{name}/{{id}}", name=f"get_{name}")
    async def get_row(request: Request, id: str,
                      delay_ms: int = Query(0, ge=0, le=3000, alias='_delay_ms'),
                      status: Literal['200', '400', '401', '403', '404', '429', '500', '503'] = Query('200', alias='_status')):
        simulated = await simulate(request, delay_ms, status)
        if simulated is not None:
            return simulated
        for row in rows:
            if row["id"] == id:
                return row
        raise HTTPException(404, "Record not found")

    return routes
