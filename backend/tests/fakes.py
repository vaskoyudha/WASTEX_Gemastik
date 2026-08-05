from uuid import uuid4

import jwt


class FakeAuth:
    """Mock Supabase auth for testing."""

    def __init__(self):
        self.users = []

    def get_user(self, token: str) -> object:
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError("token has no sub")
        user = type("User", (), {"id": user_id})()
        return type("Response", (), {"user": user})()

    def sign_up(self, params: dict) -> object:
        """Mock user registration."""

        class Response:
            pass

        response = Response()
        user_id = str(uuid4())
        response.user = type("User", (), {"id": user_id})()
        response.access_token = f"fake_jwt_token_{user_id}"
        response.session = type("Session", (), {"access_token": f"fake_jwt_token_{user_id}"})()
        response.error = None
        self.users.append({"id": user_id, **params})
        return response

    def sign_in_with_password(self, params: dict) -> object:
        """Mock user login."""

        class Response:
            pass

        response = Response()
        # Find existing user (for simplicity, just create one)
        user_id = str(uuid4())
        response.user = type("User", (), {"id": user_id})()
        response.access_token = f"fake_jwt_token_{user_id}"
        response.session = type("Session", (), {"access_token": f"fake_jwt_token_{user_id}"})()
        response.error = None
        return response


class FakeResult:
    def __init__(self, data):
        self.data = data

    def execute(self):
        return self

    def eq(self, *args):
        return self

    def neq(self, *args):
        return self

    def order(self, *args, **kwargs):
        return self

    def range(self, *args):
        return self

    def limit(self, *args):
        return self

    def single(self):
        if isinstance(self.data, list):
            self.data = self.data[0] if self.data else None
        return self


class FakeTable:
    def __init__(self, rows=None):
        self.rows = rows or []
        self.inserted = []
        self.updated = []

    def insert(self, data):
        items = data if isinstance(data, list) else [data]
        stored = []
        for item in items:
            stored_item = {**item}
            if "id" not in stored_item:
                stored_item["id"] = str(uuid4())
            # Add timestamps if not present (to match Supabase behavior)
            if "created_at" not in stored_item:
                stored_item["created_at"] = "2026-01-01T00:00:00Z"
            if "updated_at" not in stored_item:
                stored_item["updated_at"] = "2026-01-01T00:00:00Z"
            stored.append(stored_item)
        self.inserted.extend(stored)
        self.rows.extend(stored)
        return FakeResult(stored)

    def select(self, *args):
        cols = args[0] if args else "*"
        if cols == "*":
            return FakeResult(list(self.rows))
        keys = [c.strip() for c in cols.split(",") if c.strip()]
        return FakeResult([{k: row[k] for k in keys if k in row} for row in self.rows])

    def update(self, data):
        self.updated.append(data)
        for row in self.rows:
            row.update(data)
        return FakeResult(list(self.rows))

    def delete(self):
        self.rows.clear()
        return FakeResult([])


class FakeStorageBucket:
    def __init__(self):
        self.uploads = []
        self.removed = []
        self._stored: dict[str, bytes] = {}

    def upload(self, path, data, file_options=None):
        self.uploads.append((path, len(data), file_options))
        self._stored[path] = data if isinstance(data, bytes) else bytes(data)

    def download(self, path):
        return self._stored.get(path, b"")

    def remove(self, paths):
        self.removed.extend(paths)


class FakeStorage:
    def __init__(self):
        self.buckets = {}

    def from_(self, name):
        return self.buckets.setdefault(name, FakeStorageBucket())


class FakeSupabase:
    def __init__(self, tables=None):
        self.tables = {name: FakeTable(rows) for name, rows in (tables or {}).items()}
        self.storage = FakeStorage()
        self.auth = FakeAuth()

    def table(self, name):
        return self.tables.setdefault(name, FakeTable())

    def rpc(self, name, params):
        return FakeResult([])
