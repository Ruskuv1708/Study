from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from modules.registry.registry_models import Client, ClientObject, Company


class RegistryService:
    CHANGED_STATUS_VALUES = {"changed_from", "changed_to"}

    @staticmethod
    def _normalize_status(status: Optional[str]) -> str:
        normalized = (status or "new").strip().lower()
        allowed = {"new", "active", "reactivated", "deactivated", "changed_from", "changed_to"}
        if normalized not in allowed:
            raise HTTPException(status_code=400, detail="Invalid client status")
        return normalized

    @staticmethod
    def _extract_status_company_id(client: Client) -> Optional[str]:
        meta = client.meta_data if isinstance(client.meta_data, dict) else {}
        status_company_id = meta.get("status_company_id")
        if not status_company_id:
            return None
        return str(status_company_id)

    @staticmethod
    def _extract_status(client: Client) -> str:
        meta = client.meta_data if isinstance(client.meta_data, dict) else {}
        raw_status = str(meta.get("status") or "new").strip().lower()
        allowed = {"new", "active", "reactivated", "deactivated", "changed_from", "changed_to"}
        return raw_status if raw_status in allowed else "new"

    @staticmethod
    def _build_status_label(status: str, status_company_name: Optional[str]) -> str:
        if status == "changed_from":
            return f"Changed from {status_company_name}" if status_company_name else "Changed from company"
        if status == "changed_to":
            return f"Changed to {status_company_name}" if status_company_name else "Changed to company"
        labels = {
            "new": "New",
            "active": "Active",
            "reactivated": "Reactivated",
            "deactivated": "Deactivated",
        }
        return labels.get(status, "New")

    @staticmethod
    def _resolve_status_company_name(db: Session, workspace_id: UUID, status_company_id: Optional[str]) -> Optional[str]:
        if not status_company_id:
            return None
        try:
            company_uuid = UUID(str(status_company_id))
        except (TypeError, ValueError):
            return None
        company = (
            db.query(Company)
            .filter(Company.id == company_uuid, Company.workspace_id == workspace_id)
            .first()
        )
        return company.name if company else None

    @staticmethod
    def _serialize_company(company: Company) -> dict:
        return {
            "id": str(company.id),
            "name": company.name,
            "registration_number": company.registration_number,
            "email": company.email,
            "phone": company.phone,
            "address": company.address,
            "workspace_id": str(company.workspace_id),
            "client_count": len(company.clients or []),
            "created_at": company.created_at.isoformat() if company.created_at else None,
            "updated_at": company.updated_at.isoformat() if company.updated_at else None,
        }

    @staticmethod
    def _serialize_client(
        client: Client,
        status_company_name: Optional[str] = None,
    ) -> dict:
        status = RegistryService._extract_status(client)
        status_company_id = RegistryService._extract_status_company_id(client)
        return {
            "id": str(client.id),
            "first_name": client.first_name,
            "last_name": client.last_name,
            "email": client.email,
            "phone": client.phone,
            "notes": client.notes,
            "company_id": str(client.company_id) if client.company_id else None,
            "company_name": client.company.name if client.company else None,
            "status": status,
            "status_company_id": status_company_id,
            "status_company_name": status_company_name,
            "status_label": RegistryService._build_status_label(status, status_company_name),
            "workspace_id": str(client.workspace_id),
            "created_at": client.created_at.isoformat() if client.created_at else None,
            "updated_at": client.updated_at.isoformat() if client.updated_at else None,
        }

    @staticmethod
    def _serialize_client_object(client_object: ClientObject) -> dict:
        assignment_type = "unassigned"
        assignment_name: Optional[str] = None
        if client_object.client_id and client_object.client:
            assignment_type = "client"
            assignment_name = f"{client_object.client.first_name} {client_object.client.last_name}".strip()
        elif client_object.company_id and client_object.company:
            assignment_type = "company"
            assignment_name = client_object.company.name

        return {
            "id": str(client_object.id),
            "name": client_object.name,
            "client_id": str(client_object.client_id) if client_object.client_id else None,
            "client_name": f"{client_object.client.first_name} {client_object.client.last_name}".strip() if client_object.client else None,
            "company_id": str(client_object.company_id) if client_object.company_id else None,
            "company_name": client_object.company.name if client_object.company else None,
            "assignment_type": assignment_type,
            "assignment_name": assignment_name,
            "attributes": client_object.attributes if isinstance(client_object.attributes, dict) else {},
            "workspace_id": str(client_object.workspace_id),
            "created_at": client_object.created_at.isoformat() if client_object.created_at else None,
            "updated_at": client_object.updated_at.isoformat() if client_object.updated_at else None,
        }

    @staticmethod
    def _normalize_attributes(attributes: Optional[dict]) -> dict[str, str]:
        if attributes is None:
            return {}
        if not isinstance(attributes, dict):
            raise HTTPException(status_code=400, detail="Object attributes must be a key-value map")

        normalized: dict[str, str] = {}
        for raw_key, raw_value in attributes.items():
            key = str(raw_key or "").strip()
            if not key:
                continue
            normalized[key] = str(raw_value or "").strip()
        return normalized

    @staticmethod
    def _resolve_client(db: Session, workspace_id: UUID, client_id: Optional[UUID]) -> Optional[Client]:
        if not client_id:
            return None
        client = (
            db.query(Client)
            .filter(Client.id == client_id, Client.workspace_id == workspace_id)
            .first()
        )
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")
        return client

    @staticmethod
    def _resolve_company(db: Session, workspace_id: UUID, company_id: Optional[UUID]) -> Optional[Company]:
        if not company_id:
            return None
        company = (
            db.query(Company)
            .filter(Company.id == company_id, Company.workspace_id == workspace_id)
            .first()
        )
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")
        return company

    @staticmethod
    def _resolve_object_assignment(
        db: Session,
        workspace_id: UUID,
        client_id: Optional[UUID],
        company_id: Optional[UUID],
    ) -> tuple[Optional[Client], Optional[Company]]:
        if client_id and company_id:
            raise HTTPException(
                status_code=400,
                detail="Object can be assigned either to a client or to a company, not both.",
            )
        client = RegistryService._resolve_client(db, workspace_id, client_id)
        company = RegistryService._resolve_company(db, workspace_id, company_id)
        return client, company

    @staticmethod
    def create_company(
        db: Session,
        workspace_id: UUID,
        name: str,
        registration_number: Optional[str],
        email: Optional[str],
        phone: Optional[str],
        address: Optional[str],
    ) -> dict:
        company = Company(
            name=name.strip(),
            registration_number=(registration_number or "").strip() or None,
            email=(email or "").strip() or None,
            phone=(phone or "").strip() or None,
            address=(address or "").strip() or None,
            workspace_id=workspace_id,
        )
        db.add(company)
        db.commit()
        db.refresh(company)
        return RegistryService._serialize_company(company)

    @staticmethod
    def list_companies(db: Session, workspace_id: UUID) -> list[dict]:
        companies = (
            db.query(Company)
            .options(joinedload(Company.clients))
            .filter(Company.workspace_id == workspace_id)
            .order_by(Company.created_at.desc())
            .all()
        )
        return [RegistryService._serialize_company(company) for company in companies]

    @staticmethod
    def update_company(
        db: Session,
        company_id: UUID,
        workspace_id: UUID,
        name: Optional[str],
        registration_number: Optional[str],
        email: Optional[str],
        phone: Optional[str],
        address: Optional[str],
    ) -> dict:
        company = (
            db.query(Company)
            .options(joinedload(Company.clients))
            .filter(Company.id == company_id, Company.workspace_id == workspace_id)
            .first()
        )
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        if name is not None:
            normalized = name.strip()
            if not normalized:
                raise HTTPException(status_code=400, detail="Company name cannot be empty")
            company.name = normalized
        if registration_number is not None:
            company.registration_number = registration_number.strip() or None
        if email is not None:
            company.email = email.strip() or None
        if phone is not None:
            company.phone = phone.strip() or None
        if address is not None:
            company.address = address.strip() or None

        db.commit()
        db.refresh(company)
        return RegistryService._serialize_company(company)

    @staticmethod
    def delete_company(db: Session, company_id: UUID, workspace_id: UUID) -> dict:
        company = (
            db.query(Company)
            .options(joinedload(Company.clients))
            .filter(Company.id == company_id, Company.workspace_id == workspace_id)
            .first()
        )
        if not company:
            raise HTTPException(status_code=404, detail="Company not found")

        if company.clients:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete company with linked clients. Reassign or remove clients first.",
            )

        has_objects = (
            db.query(ClientObject.id)
            .filter(ClientObject.workspace_id == workspace_id, ClientObject.company_id == company_id)
            .first()
            is not None
        )
        if has_objects:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete company with assigned objects. Reassign or remove objects first.",
            )

        db.delete(company)
        db.commit()
        return {"message": "Company deleted"}

    @staticmethod
    def create_client_object(
        db: Session,
        workspace_id: UUID,
        name: str,
        client_id: Optional[UUID],
        company_id: Optional[UUID],
        attributes: Optional[dict],
    ) -> dict:
        normalized_name = name.strip()
        if not normalized_name:
            raise HTTPException(status_code=400, detail="Object name cannot be empty")

        client, company = RegistryService._resolve_object_assignment(
            db=db,
            workspace_id=workspace_id,
            client_id=client_id,
            company_id=company_id,
        )
        normalized_attributes = RegistryService._normalize_attributes(attributes)

        client_object = ClientObject(
            name=normalized_name,
            client_id=client.id if client else None,
            company_id=company.id if company else None,
            attributes=normalized_attributes,
            workspace_id=workspace_id,
        )
        db.add(client_object)
        db.commit()
        db.refresh(client_object)
        db.refresh(client_object, attribute_names=["client", "company"])
        return RegistryService._serialize_client_object(client_object)

    @staticmethod
    def list_client_objects(
        db: Session,
        workspace_id: UUID,
        client_id: Optional[UUID] = None,
        company_id: Optional[UUID] = None,
    ) -> list[dict]:
        query = (
            db.query(ClientObject)
            .options(joinedload(ClientObject.client), joinedload(ClientObject.company))
            .filter(ClientObject.workspace_id == workspace_id)
        )
        if client_id:
            query = query.filter(ClientObject.client_id == client_id)
        if company_id:
            query = query.filter(ClientObject.company_id == company_id)

        objects = query.order_by(ClientObject.created_at.desc()).all()
        return [RegistryService._serialize_client_object(item) for item in objects]

    @staticmethod
    def update_client_object(
        db: Session,
        object_id: UUID,
        workspace_id: UUID,
        name: Optional[str],
        client_id: Optional[UUID],
        company_id: Optional[UUID],
        attributes: Optional[dict],
        changed_fields: Optional[set[str]] = None,
    ) -> dict:
        client_object = (
            db.query(ClientObject)
            .options(joinedload(ClientObject.client), joinedload(ClientObject.company))
            .filter(ClientObject.id == object_id, ClientObject.workspace_id == workspace_id)
            .first()
        )
        if not client_object:
            raise HTTPException(status_code=404, detail="Client object not found")

        if changed_fields is None:
            changed_fields = set()

        if "name" in changed_fields and name is not None:
            normalized_name = name.strip()
            if not normalized_name:
                raise HTTPException(status_code=400, detail="Object name cannot be empty")
            client_object.name = normalized_name

        next_client_id = client_object.client_id
        next_company_id = client_object.company_id

        if "client_id" in changed_fields:
            next_client_id = client_id
        if "company_id" in changed_fields:
            next_company_id = company_id

        if "client_id" in changed_fields and "company_id" not in changed_fields and next_client_id:
            next_company_id = None
        if "company_id" in changed_fields and "client_id" not in changed_fields and next_company_id:
            next_client_id = None

        if "client_id" in changed_fields or "company_id" in changed_fields:
            client, company = RegistryService._resolve_object_assignment(
                db=db,
                workspace_id=workspace_id,
                client_id=next_client_id,
                company_id=next_company_id,
            )
            client_object.client_id = client.id if client else None
            client_object.company_id = company.id if company else None

        if "attributes" in changed_fields:
            client_object.attributes = RegistryService._normalize_attributes(attributes)

        db.commit()
        db.refresh(client_object)
        db.refresh(client_object, attribute_names=["client", "company"])
        return RegistryService._serialize_client_object(client_object)

    @staticmethod
    def delete_client_object(db: Session, object_id: UUID, workspace_id: UUID) -> dict:
        client_object = (
            db.query(ClientObject)
            .filter(ClientObject.id == object_id, ClientObject.workspace_id == workspace_id)
            .first()
        )
        if not client_object:
            raise HTTPException(status_code=404, detail="Client object not found")

        db.delete(client_object)
        db.commit()
        return {"message": "Client object deleted"}

    @staticmethod
    def create_client(
        db: Session,
        workspace_id: UUID,
        first_name: str,
        last_name: str,
        email: Optional[str],
        phone: Optional[str],
        company_id: Optional[UUID],
        notes: Optional[str],
        status: Optional[str],
        status_company_id: Optional[UUID],
    ) -> dict:
        company = None
        if company_id:
            company = (
                db.query(Company)
                .filter(Company.id == company_id, Company.workspace_id == workspace_id)
                .first()
            )
            if not company:
                raise HTTPException(status_code=404, detail="Company not found")

        normalized_status = RegistryService._normalize_status(status)
        status_company = None
        if status_company_id:
            status_company = (
                db.query(Company)
                .filter(Company.id == status_company_id, Company.workspace_id == workspace_id)
                .first()
            )
            if not status_company:
                raise HTTPException(status_code=404, detail="Status company not found")

        if normalized_status in RegistryService.CHANGED_STATUS_VALUES and not status_company:
            raise HTTPException(status_code=400, detail="Select company for changed status")
        if normalized_status not in RegistryService.CHANGED_STATUS_VALUES and status_company:
            raise HTTPException(status_code=400, detail="Status company is only allowed for changed statuses")

        meta_data = {
            "status": normalized_status,
        }
        if status_company:
            meta_data["status_company_id"] = str(status_company.id)

        client = Client(
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            email=(email or "").strip() or None,
            phone=(phone or "").strip() or None,
            company_id=company.id if company else None,
            notes=(notes or "").strip() or None,
            workspace_id=workspace_id,
            meta_data=meta_data,
        )
        db.add(client)
        db.commit()
        db.refresh(client)
        db.refresh(client, attribute_names=["company"])
        return RegistryService._serialize_client(client, status_company.name if status_company else None)

    @staticmethod
    def list_clients(db: Session, workspace_id: UUID, company_id: Optional[UUID] = None) -> list[dict]:
        query = (
            db.query(Client)
            .options(joinedload(Client.company))
            .filter(Client.workspace_id == workspace_id)
        )
        if company_id:
            query = query.filter(Client.company_id == company_id)

        clients = query.order_by(Client.created_at.desc()).all()
        status_company_ids: set[str] = set()
        for client in clients:
            status_company_id = RegistryService._extract_status_company_id(client)
            if status_company_id:
                status_company_ids.add(status_company_id)

        status_company_name_map: dict[str, str] = {}
        if status_company_ids:
            valid_company_ids: list[UUID] = []
            for raw_company_id in status_company_ids:
                try:
                    valid_company_ids.append(UUID(raw_company_id))
                except (TypeError, ValueError):
                    continue

            if valid_company_ids:
                companies = (
                    db.query(Company)
                    .filter(Company.workspace_id == workspace_id, Company.id.in_(valid_company_ids))
                    .all()
                )
                status_company_name_map = {str(company.id): company.name for company in companies}

        return [
            RegistryService._serialize_client(
                client,
                status_company_name_map.get(RegistryService._extract_status_company_id(client) or ""),
            )
            for client in clients
        ]

    @staticmethod
    def update_client(
        db: Session,
        client_id: UUID,
        workspace_id: UUID,
        first_name: Optional[str],
        last_name: Optional[str],
        email: Optional[str],
        phone: Optional[str],
        company_id: Optional[UUID],
        notes: Optional[str],
        status: Optional[str],
        status_company_id: Optional[UUID],
        changed_fields: Optional[set[str]] = None,
    ) -> dict:
        client = (
            db.query(Client)
            .options(joinedload(Client.company))
            .filter(Client.id == client_id, Client.workspace_id == workspace_id)
            .first()
        )
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        if changed_fields is None:
            changed_fields = set()

        if "company_id" in changed_fields and company_id:
            company = (
                db.query(Company)
                .filter(Company.id == company_id, Company.workspace_id == workspace_id)
                .first()
            )
            if not company:
                raise HTTPException(status_code=404, detail="Company not found")
            client.company_id = company.id
        elif "company_id" in changed_fields and company_id is None:
            client.company_id = None

        if "first_name" in changed_fields and first_name is not None:
            normalized_first_name = first_name.strip()
            if not normalized_first_name:
                raise HTTPException(status_code=400, detail="Client first name cannot be empty")
            client.first_name = normalized_first_name
        if "last_name" in changed_fields and last_name is not None:
            normalized_last_name = last_name.strip()
            if not normalized_last_name:
                raise HTTPException(status_code=400, detail="Client last name cannot be empty")
            client.last_name = normalized_last_name
        if "email" in changed_fields and email is not None:
            client.email = email.strip() or None
        if "phone" in changed_fields and phone is not None:
            client.phone = phone.strip() or None
        if "notes" in changed_fields and notes is not None:
            client.notes = notes.strip() or None

        current_status = RegistryService._extract_status(client)
        next_status = current_status
        if "status" in changed_fields:
            next_status = RegistryService._normalize_status(status)

        meta_data = dict(client.meta_data or {})
        status_company = None
        next_status_company_id = RegistryService._extract_status_company_id(client)
        if "status_company_id" in changed_fields:
            if status_company_id:
                status_company = (
                    db.query(Company)
                    .filter(Company.id == status_company_id, Company.workspace_id == workspace_id)
                    .first()
                )
                if not status_company:
                    raise HTTPException(status_code=404, detail="Status company not found")
                next_status_company_id = str(status_company.id)
            else:
                next_status_company_id = None

        if next_status in RegistryService.CHANGED_STATUS_VALUES and not next_status_company_id:
            raise HTTPException(status_code=400, detail="Select company for changed status")
        if next_status not in RegistryService.CHANGED_STATUS_VALUES:
            next_status_company_id = None

        meta_data["status"] = next_status
        if next_status_company_id:
            meta_data["status_company_id"] = next_status_company_id
        else:
            meta_data.pop("status_company_id", None)
        client.meta_data = meta_data

        db.commit()
        db.refresh(client)
        db.refresh(client, attribute_names=["company"])
        if not status_company and next_status_company_id:
            status_company_name = RegistryService._resolve_status_company_name(db, workspace_id, next_status_company_id)
        else:
            status_company_name = status_company.name if status_company else None
        return RegistryService._serialize_client(client, status_company_name)

    @staticmethod
    def delete_client(db: Session, client_id: UUID, workspace_id: UUID) -> dict:
        client = (
            db.query(Client)
            .filter(Client.id == client_id, Client.workspace_id == workspace_id)
            .first()
        )
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        has_objects = (
            db.query(ClientObject.id)
            .filter(ClientObject.workspace_id == workspace_id, ClientObject.client_id == client_id)
            .first()
            is not None
        )
        if has_objects:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete client with assigned objects. Reassign or remove objects first.",
            )

        db.delete(client)
        db.commit()
        return {"message": "Client deleted"}
