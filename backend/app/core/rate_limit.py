import time
from collections import defaultdict
from fastapi import Request, HTTPException, status

class InMemoryRateLimiter:
    """
    Sliding window in-memory rate limiter for protecting sensitive authorization endpoints.
    Tracks timestamps per key and prunes older entries.
    """
    def __init__(self, max_requests: int = 60, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.clients = defaultdict(list)

    def check(self, key: str):
        now = time.time()
        cutoff = now - self.window_seconds
        
        # Filter out timestamps older than the sliding window
        self.clients[key] = [t for t in self.clients[key] if t > cutoff]
        
        if len(self.clients[key]) >= self.max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded: max {self.max_requests} requests per {self.window_seconds}s. Please retry shortly."
            )
        
        self.clients[key].append(now)

# Global rate limiter instances:
# 1. Authorize limiter: 120 req / min per IP/key
authorize_limiter = InMemoryRateLimiter(max_requests=120, window_seconds=60)
# 2. Key provisioning limiter: 20 req / min per IP
provisioning_limiter = InMemoryRateLimiter(max_requests=20, window_seconds=60)

async def rate_limit_authorize(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    api_key = request.headers.get("X-API-Key") or client_ip
    authorize_limiter.check(f"auth_{api_key}")

async def rate_limit_provisioning(request: Request):
    client_ip = request.client.host if request.client else "unknown"
    provisioning_limiter.check(f"prov_{client_ip}")
