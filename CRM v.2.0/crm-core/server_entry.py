from fastapi import FastAPI

crm_core_app = FastAPI()

@crm_core_app.get("/")
async def root():
    return {"message": "Hello World"}

