import asyncio
import hashlib
import hmac
import math
import re
import secrets
import time
from collections import OrderedDict, deque

from starlette.datastructures import Headers
from starlette.responses import JSONResponse

from utility.settings import API_PREFIX


class AbuseLimits:
    def __init__(self):
        self.key = secrets.token_bytes(32)
        self.now = time.monotonic
        self.global_limits = {'read': 600, 'write': 60, 'health': 60}
        self.client_limits = {'read': 120, 'write': 3}
        self.playground_limits = {'read': 240, 'write': 3}
        self.global_windows = {name: deque() for name in self.global_limits}
        self.actors = OrderedDict()
        self.max_actors = 2048

    def identity(self, scope):
        token = Headers(scope=scope).get('x-doppel-client', '')
        if re.fullmatch(r'[A-Za-z0-9_-]{24}\.[0-9]{1,12}\.[a-f0-9]{64}', token):
            payload, signature = token.rsplit('.', 1)
            issued = int(payload.split('.')[1])
            expected = hmac.digest(self.key, payload.encode(), 'sha256').hex()
            if 0 <= time.time() - issued <= 1800 and hmac.compare_digest(signature, expected):
                return payload.split('.')[0], None
        payload = f'{secrets.token_urlsafe(18)}.{int(time.time())}'
        return 'anonymous', f'{payload}.{hmac.digest(self.key, payload.encode(), "sha256").hex()}'

    def take(self, window, limit, now):
        while window and window[0] <= now - 60:
            window.popleft()
        if limit <= 0 or len(window) >= limit:
            return max(1, math.ceil(window[0] + 60 - now)) if window else 60
        window.append(now)
        return 0

    def actor(self, key, now):
        while self.actors and next(iter(self.actors.values()))['seen'] <= now - 60:
            self.actors.popitem(last=False)
        actor = self.actors.get(key)
        if actor is None:
            if len(self.actors) >= self.max_actors:
                return None
            actor = {'seen': now, 'read': deque(), 'write': deque()}
            self.actors[key] = actor
        actor['seen'] = now
        self.actors.move_to_end(key)
        return actor

    def admit(self, scope, identity):
        now = self.now()
        category = 'write' if scope['method'] in {'POST', 'PUT'} else 'read'
        if scope['path'] == f'{API_PREFIX}/health' and scope['method'] in {'GET', 'HEAD'}:
            category = 'health'
        retry = self.take(self.global_windows[category], self.global_limits[category], now)
        if retry or category == 'health':
            return retry
        keys = [(('client', identity), self.client_limits)]
        if scope['path'].startswith(f'{API_PREFIX}/playgrounds/'):
            session = scope['path'][len(f'{API_PREFIX}/playgrounds/'):].split('/', 1)[0]
            keys.append((('playground', hashlib.sha256(session.encode()).digest()), self.playground_limits))
        for key, limits in keys:
            actor = self.actor(key, now)
            if actor is None:
                return 60
            retry = self.take(actor[category], limits[category], now)
            if retry:
                return retry
        return 0


class APIGuards:
    def __init__(self, app, abuse=None):
        self.app = app
        self.abuse = abuse if abuse is not None else AbuseLimits()
        self.body_timeout = 5

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or not (scope['path'] == API_PREFIX or scope['path'].startswith(API_PREFIX + '/')):
            await self.app(scope, receive, send)
            return
        issued_token = None

        async def guarded_send(message):
            if message['type'] == 'http.response.start':
                headers = [(key, value) for key, value in message.get('headers', []) if key.lower() not in {b'cache-control', b'referrer-policy'}]
                headers += [(b'cache-control', b'no-store'), (b'referrer-policy', b'no-referrer'), (b'x-content-type-options', b'nosniff')]
                if issued_token:
                    headers.append((b'x-doppel-client', issued_token.encode()))
                message = {**message, 'headers': headers}
            await send(message)

        async def reject(status, detail, headers=None):
            await JSONResponse({'detail': detail}, status_code=status, headers=headers)(scope, receive, guarded_send)

        if len(scope.get('raw_path', scope['path'].encode())) + len(scope.get('query_string', b'')) > 8192:
            await reject(414, 'Request URL exceeds the 8 KiB limit.')
            return
        if sum(len(key) + len(value) for key, value in scope.get('headers', [])) > 16384:
            await reject(431, 'Request headers exceed the 16 KiB limit.')
            return
        identity, new_token = self.abuse.identity(scope)
        retry = self.abuse.admit(scope, identity)
        if retry:
            await reject(429, 'Fair-use request limit reached. Retry after the indicated delay.', {'Retry-After': str(retry)})
            return
        issued_token = new_token
        if scope['method'] in {'POST', 'PUT'}:
            lengths = [value for key, value in scope.get('headers', []) if key.lower() == b'content-length']
            if len(lengths) > 1 or any(not value.isdigit() for value in lengths):
                await reject(400, 'Invalid Content-Length header.')
                return
            if lengths and (len(lengths[0]) > 10 or int(lengths[0]) > 131072):
                await reject(413, 'Request exceeds the 128 KiB limit.')
                return
            body = bytearray()
            oversized = False
            try:
                async with asyncio.timeout(self.body_timeout):
                    while True:
                        message = await receive()
                        if message['type'] == 'http.disconnect':
                            return
                        chunk = message.get('body', b'')
                        if len(body) + len(chunk) > 131072:
                            oversized = True
                            break
                        body.extend(chunk)
                        if not message.get('more_body', False):
                            break
            except TimeoutError:
                await reject(408, 'Request body took too long to upload.')
                return
            if oversized:
                await reject(413, 'Request exceeds the 128 KiB limit.')
                return
            delivered = False

            async def buffered_receive():
                nonlocal delivered
                if delivered:
                    return await receive()
                delivered = True
                return {'type': 'http.request', 'body': bytes(body), 'more_body': False}

            await self.app(scope, buffered_receive, guarded_send)
        else:
            await self.app(scope, receive, guarded_send)
