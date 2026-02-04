from fastapi.testclient import TestClient
import uuid # <-- Import this

# Global storage for the test session
global_data = {
    "tenant_id": None,
    "user_email": f"admin_{uuid.uuid4().hex[:6]}@test.com", # Random Email
    "user_pass": "secure123",
    "token": None,
    "subdomain": f"test_{uuid.uuid4().hex[:6]}" # Random Subdomain
}

def test_1_create_tenant(client: TestClient):
    """ Step 1: Register a new Company with Random Name """
    print(f"\n⚡ Creating Tenant with subdomain: {global_data['subdomain']}")
    
    response = client.post("/access/tenants", json={
        "name": f"Test Company {global_data['subdomain']}",
        "subdomain_prefix": global_data["subdomain"],
        "meta_data": {"industry": "testing"}
    })
    
    assert response.status_code == 200
    data = response.json()
    
    # Save ID for next step
    global_data["tenant_id"] = data["id"]
    print(f"✅ Tenant Created: {data['id']}")

def test_2_create_user(client: TestClient):
    """ Step 2: Create the Admin User """
    print(f"⚡ Creating User: {global_data['user_email']}")
    
    response = client.post("/access/users", json={
        "email": global_data["user_email"],
        "password": global_data["user_pass"],
        "full_name": "Test Admin",
        "tenant_id": global_data["tenant_id"]
    })
    assert response.status_code == 200
    print("✅ User Created")

def test_3_login(client: TestClient):
    """ Step 3: Login """
    response = client.post("/access/token", data={
        "username": global_data["user_email"],
        "password": global_data["user_pass"]
    })
    assert response.status_code == 200
    
    data = response.json()
    global_data["token"] = data["access_token"]
    print("✅ Login Successful")

def test_4_create_request(client: TestClient):
    """ Step 4: Create a Request """
    headers = {
        "Authorization": f"Bearer {global_data['token']}",
        "host": f"{global_data['subdomain']}.localhost" # Use the random subdomain
    }
    
    response = client.post("/request/create", headers=headers, json={
        "title": "Automated Test Request",
        "description": "This request was made by pytest.",
        "priority": "high"
    })
    
    assert response.status_code == 200
    print(f"✅ Request Created: {response.json()['id']}")