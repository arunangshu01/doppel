from starlette.responses import JSONResponse

from utility.settings import API_PREFIX


class APIGuards:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not scope["path"].startswith(API_PREFIX + "/"):
            await self.app(scope, receive, send)
            return

        async def guarded_send(message):
            if message["type"] == "http.response.start":
                headers = [(key, value) for key, value in message.get("headers", []) if key.lower() not in {b"cache-control", b"referrer-policy"}]
                message = {**message, "headers": headers + [(b"cache-control", b"no-store"), (b"referrer-policy", b"no-referrer"), (b"x-content-type-options", b"nosniff")]}
            await send(message)

        if scope["method"] in {"POST", "PUT"}:
            body = bytearray()
            while True:
                message = await receive()
                if message["type"] == "http.disconnect":
                    return
                chunk = message.get("body", b"")
                if len(body) + len(chunk) > 131072:
                    await JSONResponse({"detail": "Request exceeds the 128 KiB limit."}, status_code=413)(scope, receive, guarded_send)
                    return
                body.extend(chunk)
                if not message.get("more_body", False):
                    break
            delivered = False

            async def buffered_receive():
                nonlocal delivered
                if delivered:
                    return await receive()
                delivered = True
                return {"type": "http.request", "body": bytes(body), "more_body": False}

            await self.app(scope, buffered_receive, guarded_send)
        else:
            await self.app(scope, receive, guarded_send)
