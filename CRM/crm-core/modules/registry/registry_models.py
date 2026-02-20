from sqlalchemy import Column, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from core.base_models import CRMBasedModel


class Company(CRMBasedModel):
    __tablename__ = "registry_companies"
    __table_args__ = (
        Index("ix_registry_companies_workspace_id", "workspace_id"),
        Index("ix_registry_companies_workspace_name", "workspace_id", "name"),
    )

    name = Column(String, nullable=False)
    registration_number = Column(String, nullable=True)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)

    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)

    clients = relationship("Client", back_populates="company")


class Client(CRMBasedModel):
    __tablename__ = "registry_clients"
    __table_args__ = (
        Index("ix_registry_clients_workspace_id", "workspace_id"),
        Index("ix_registry_clients_workspace_company", "workspace_id", "company_id"),
        Index("ix_registry_clients_workspace_email", "workspace_id", "email"),
    )

    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    email = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    company_id = Column(UUID(as_uuid=True), ForeignKey("registry_companies.id"), nullable=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("access_workspaces.id"), nullable=False)

    company = relationship("Company", back_populates="clients")

