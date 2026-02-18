from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timezone
import logging
from typing import List
from core.database_connector import get_db
from modules.access_control.access_security import get_current_user
from modules.access_control.access_models import User
from modules.access_control.access_enums import UserRole
from modules.access_control.access_permissions import PermissionService
from core.config import settings
from modules.workspace_management.workspace_schemas import (
    WorkspaceCreateSchema,
    WorkspaceUpdateSchema,
    WorkspaceResponseSchema,
)
from modules.workspace_management.workspace_service import WorkspaceService

# Настройка логгирования
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/superadmin",
    tags=["Workspace Management (Superadmin Only)"]
)

# ========================================
# SECURITY DECORATOR
# ========================================

def require_superadmin_access(func):
    """
    Декора́тор для гарантии доступа только суперадминистратора
    """
    async def wrapper(
        *args,
        current_user=Depends(get_current_user),
        **kwargs
    ):
        if current_user.role != UserRole.SUPERADMIN:
            logger.warning(
                f"🚨 SECURITY ALERT: Несанкционированная попытка доступа суперадмина.\n"
                f"   Пользователь: {current_user.email}\n"
                f"   Роль: {current_user.role}\n"
                f"   Время: {datetime.now(timezone.utc)}"
            )
            raise HTTPException(
                status_code=403,
                detail="Доступ запрещен: требуются привилегии суперадмина"
            )
        logger.info(
            f"✅ Доступ суперадмина - Пользователь: {current_user.email} - Метод: {func.__name__}"
        )
        return await func(*args, current_user=current_user, **kwargs)
    return wrapper

# ========================================
# WORKSPACE MANAGEMENT ENDPOINTS
# ========================================

@router.post("/workspaces", response_model=dict)
async def create_workspace(
    data: WorkspaceCreateSchema,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Создание новой рабочей области (только для суперадмина)
    """
    PermissionService.require_role(current_user, UserRole.SUPERADMIN)
    try:
        result = WorkspaceService.create_workspace(db, data)
        
        logger.info(
            f"✅ AUDIT: Рабочая область создана пользователем {current_user.email}\n"
            f"   Название: {data.workspace_name}\n"
            f"   Субдомен: {data.subdomain_prefix}\n"
            f"   Время: {datetime.now(timezone.utc)}"
        )
        return result
    except Exception as e:
        logger.error(f"❌ Ошибка при создании рабочей области: {e}")
        raise

@router.get("/workspaces", response_model=List[WorkspaceResponseSchema])
async def list_workspaces(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    skip: int = 0,
    limit: int = settings.DEFAULT_PAGE_SIZE
):
    """
    Список всех рабочих областей (только для суперадмина)
    """
    PermissionService.require_role(current_user, UserRole.SUPERADMIN)
    logger.info(f"✅ Получение списка рабочих областей пользователем {current_user.email}")
    limit = max(1, min(limit, settings.MAX_PAGE_SIZE))
    skip = max(skip, 0)
    return WorkspaceService.list_workspaces(db, skip=skip, limit=limit)

@router.get("/workspaces/{workspace_id}", response_model=dict)
async def get_workspace(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Детали конкретной рабочей области
    """
    from modules.access_control.access_models import Workspace
    if current_user.role != UserRole.SUPERADMIN and current_user.workspace_id != workspace_id:
        raise HTTPException(status_code=403, detail="Нет доступа к другим рабочим областям")
    workspace = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail="Рабочая область не найдена")
    return {
        "id": str(workspace.id),
        "name": workspace.name,
        "is_active": workspace.is_active,
        "created_at": workspace.created_at
    }

@router.post("/workspaces/{workspace_id}/suspend", deprecated=True)
async def suspend_workspace(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Приостанавливает рабочую область (только для суперадмина)
    Deprecated: use PUT /superadmin/workspaces/{workspace_id}/suspend
    """
    PermissionService.require_role(current_user, UserRole.SUPERADMIN)
    logger.warning(
        f"🚨 CRITICAL: Приостановка рабочей области пользователем {current_user.email}\n"
        f"   Идентификатор рабочей области: {workspace_id}\n"
        f"   Время: {datetime.now(timezone.utc)}"
    )
    return WorkspaceService.suspend_workspace(db, workspace_id)

# ======================================================
# Новый роут для получения списка рабочих областей с количеством пользователей
# ======================================================

@router.get("/workspaces-with-user-count", response_model=List[dict])
def get_all_workspaces_with_user_count(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    skip: int = 0,
    limit: int = settings.DEFAULT_PAGE_SIZE
):
    """
    Получить все рабочие области с указанием количества пользователей (только для суперадмина)
    """
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Только суперадмин может просматривать все рабочие области")
    from modules.access_control.access_models import Workspace
    from sqlalchemy import func
    limit = max(1, min(limit, settings.MAX_PAGE_SIZE))
    skip = max(skip, 0)
    workspaces = db.query(
        Workspace.id,
        Workspace.name,
        Workspace.is_active,
        func.count(User.id).label('user_count')
    ).outerjoin(User).group_by(Workspace.id).offset(skip).limit(limit).all()
    return [
        {
            "id": str(ws.id),
            "name": ws.name,
            "is_active": ws.is_active,
            "user_count": ws.user_count
        }
        for ws in workspaces
    ]

@router.put("/workspaces/{workspace_id}/suspend")
def suspend_workspace_put(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Приостановка рабочей области (только для суперадмина)
    """
    PermissionService.require_role(current_user, UserRole.SUPERADMIN)
    return WorkspaceService.suspend_workspace(db, workspace_id)

@router.put("/workspaces/{workspace_id}/activate")
def activate_workspace(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Активация рабочей области (только для суперадмина)
    """
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Только суперадмин может активировать рабочую область")
    return WorkspaceService.activate_workspace(db, workspace_id)

@router.put("/workspaces/{workspace_id}")
def update_workspace(
    workspace_id: UUID,
    data: WorkspaceUpdateSchema,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Обновляет детали рабочей области (только для суперадмина)
    """
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Только суперадмин может обновить рабочую область")
    workspace = WorkspaceService.update_workspace(
        db,
        workspace_id,
        workspace_name=data.workspace_name,
        status=data.status,
        settings=data.settings
    )
    return {"message": f"Рабочая область '{workspace.name}' успешно обновлена"}
