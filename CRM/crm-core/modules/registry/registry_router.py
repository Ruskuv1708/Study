from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database_connector import get_db
from core.workspace_resolver import resolve_workspace_id
from modules.access_control.access_permissions import PermissionService
from modules.access_control.access_security import get_current_user
from modules.registry.registry_schemas import (
    ClientObjectCreateSchema,
    ClientObjectUpdateSchema,
    ClientCreateSchema,
    ClientStatus,
    ClientUpdateSchema,
    CompanyCreateSchema,
    CompanyUpdateSchema,
)
from modules.registry.registry_service import RegistryService

router = APIRouter(prefix="/registry", tags=["Company Client Registry"])


@router.get("/companies")
def list_companies(
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "view_companies")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return RegistryService.list_companies(db, target_workspace)


@router.post("/companies")
def create_company(
    data: CompanyCreateSchema,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "create_company")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return RegistryService.create_company(
        db=db,
        workspace_id=target_workspace,
        name=data.name,
        registration_number=data.registration_number,
        email=data.email,
        phone=data.phone,
        address=data.address,
    )


@router.put("/companies/{company_id}")
def update_company(
    company_id: UUID,
    data: CompanyUpdateSchema,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "edit_company")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return RegistryService.update_company(
        db=db,
        company_id=company_id,
        workspace_id=target_workspace,
        name=data.name,
        registration_number=data.registration_number,
        email=data.email,
        phone=data.phone,
        address=data.address,
    )


@router.delete("/companies/{company_id}")
def delete_company(
    company_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "delete_company")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return RegistryService.delete_company(db, company_id, target_workspace)


@router.get("/clients")
def list_clients(
    company_id: Optional[UUID] = None,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "view_clients")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return RegistryService.list_clients(db, target_workspace, company_id)


@router.post("/clients")
def create_client(
    data: ClientCreateSchema,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "create_client")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return RegistryService.create_client(
        db=db,
        workspace_id=target_workspace,
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        phone=data.phone,
        company_id=data.company_id,
        notes=data.notes,
        status=data.status.value if isinstance(data.status, ClientStatus) else str(data.status),
        status_company_id=data.status_company_id,
    )


@router.put("/clients/{client_id}")
def update_client(
    client_id: UUID,
    data: ClientUpdateSchema,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "edit_client")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return RegistryService.update_client(
        db=db,
        client_id=client_id,
        workspace_id=target_workspace,
        first_name=data.first_name,
        last_name=data.last_name,
        email=data.email,
        phone=data.phone,
        company_id=data.company_id,
        notes=data.notes,
        status=data.status.value if isinstance(data.status, ClientStatus) else None,
        status_company_id=data.status_company_id,
        changed_fields=data.model_fields_set,
    )


@router.delete("/clients/{client_id}")
def delete_client(
    client_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "delete_client")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return RegistryService.delete_client(db, client_id, target_workspace)


@router.get("/objects")
def list_client_objects(
    client_id: Optional[UUID] = None,
    company_id: Optional[UUID] = None,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "view_client_objects")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return RegistryService.list_client_objects(db, target_workspace, client_id, company_id)


@router.post("/objects")
def create_client_object(
    data: ClientObjectCreateSchema,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "create_client_object")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return RegistryService.create_client_object(
        db=db,
        workspace_id=target_workspace,
        name=data.name,
        client_id=data.client_id,
        company_id=data.company_id,
        attributes=data.attributes,
    )


@router.put("/objects/{object_id}")
def update_client_object(
    object_id: UUID,
    data: ClientObjectUpdateSchema,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "edit_client_object")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return RegistryService.update_client_object(
        db=db,
        object_id=object_id,
        workspace_id=target_workspace,
        name=data.name,
        client_id=data.client_id,
        company_id=data.company_id,
        attributes=data.attributes,
        changed_fields=data.model_fields_set,
    )


@router.delete("/objects/{object_id}")
def delete_client_object(
    object_id: UUID,
    workspace_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PermissionService.require_permission(current_user, "delete_client_object")
    target_workspace = resolve_workspace_id(current_user, workspace_id)
    return RegistryService.delete_client_object(db, object_id, target_workspace)
