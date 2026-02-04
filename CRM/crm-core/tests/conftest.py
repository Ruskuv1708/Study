import pytest
from fastapi.testclient import TestClient
from server_entry import crm_core_app

# 1. THE CLIENT FIXTURE
# This creates a "Fake Browser" that sends requests to your API internally.
# It doesn't actually go out to the internet; it goes straight to the python code.
@pytest.fixture(scope="module")
def client():
    # We use a context manager to handle startup/shutdown events
    with TestClient(crm_core_app) as c:
        yield c