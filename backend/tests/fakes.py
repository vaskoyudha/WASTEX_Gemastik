from uuid import uuid4


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
        stored = [{**item, "id": item.get("id") or str(uuid4())} for item in items]
        self.inserted.extend(stored)
        self.rows.extend(stored)
        return FakeResult(stored)

    def select(self, *args):
        return FakeResult(list(self.rows))

    def update(self, data):
        self.updated.append(data)
        for row in self.rows:
            row.update(data)
        return FakeResult(list(self.rows))

    def delete(self):
        return FakeResult([])


class FakeStorageBucket:
    def __init__(self):
        self.uploads = []

    def upload(self, path, data, file_options=None):
        self.uploads.append((path, len(data), file_options))


class FakeStorage:
    def __init__(self):
        self.buckets = {}

    def from_(self, name):
        return self.buckets.setdefault(name, FakeStorageBucket())


class FakeSupabase:
    def __init__(self, tables=None):
        self.tables = {name: FakeTable(rows) for name, rows in (tables or {}).items()}
        self.storage = FakeStorage()

    def table(self, name):
        return self.tables.setdefault(name, FakeTable())

    def rpc(self, name, params):
        return FakeResult([])
