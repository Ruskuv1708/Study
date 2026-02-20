from typing import Optional
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from modules.registry.registry_models import Client, Company


class RegistryService:
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
    def _serialize_client(client: Client) -> dict:
        return {
            "id": str(client.id),
            "first_name": client.first_name,
            "last_name": client.last_name,
            "email": client.email,
            "phone": client.phone,
            "notes": client.notes,
            "company_id": str(client.company_id) if client.company_id else None,
            "company_name": client.company.name if client.company else None,
            "workspace_id": str(client.workspace_id),
            "created_at": client.created_at.isoformat() if client.created_at else None,
            "updated_at": client.updated_at.isoformat() if client.updated_at else None,
        }

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

        db.delete(company)
        db.commit()
        return {"message": "Company deleted"}

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

        client = Client(
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            email=(email or "").strip() or None,
            phone=(phone or "").strip() or None,
            company_id=company.id if company else None,
            notes=(notes or "").strip() or None,
            workspace_id=workspace_id,
        )
        db.add(client)
        db.commit()
        db.refresh(client)
        db.refresh(client, attribute_names=["company"])
        return RegistryService._serialize_client(client)

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
        return [RegistryService._serialize_client(client) for client in clients]

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
    ) -> dict:
        client = (
            db.query(Client)
            .options(joinedload(Client.company))
            .filter(Client.id == client_id, Client.workspace_id == workspace_id)
            .first()
        )
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        if company_id:
            company = (
                db.query(Company)
                .filter(Company.id == company_id, Company.workspace_id == workspace_id)
                .first()
            )
            if not company:
                raise HTTPException(status_code=404, detail="Company not found")
            client.company_id = company.id
        elif company_id is None:
            client.company_id = None

        if first_name is not None:
            normalized_first_name = first_name.strip()
            if not normalized_first_name:
                raise HTTPException(status_code=400, detail="Client first name cannot be empty")
            client.first_name = normalized_first_name
        if last_name is not None:
            normalized_last_name = last_name.strip()
            if not normalized_last_name:
                raise HTTPException(status_code=400, detail="Client last name cannot be empty")
            client.last_name = normalized_last_name
        if email is not None:
            client.email = email.strip() or None
        if phone is not None:
            client.phone = phone.strip() or None
        if notes is not None:
            client.notes = notes.strip() or None

        db.commit()
        db.refresh(client)
        db.refresh(client, attribute_names=["company"])
        return RegistryService._serialize_client(client)

    @staticmethod
    def delete_client(db: Session, client_id: UUID, workspace_id: UUID) -> dict:
        client = (
            db.query(Client)
            .filter(Client.id == client_id, Client.workspace_id == workspace_id)
            .first()
        )
        if not client:
            raise HTTPException(status_code=404, detail="Client not found")

        db.delete(client)
        db.commit()
        return {"message": "Client deleted"}

