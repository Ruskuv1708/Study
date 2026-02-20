import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { getWorkspaceParams } from './workspace'

type RegistryField = {
  key?: string
  label?: string
  type?: string
}

const normalizeText = (value?: string) => (value || '').trim().toLowerCase()

export const REQUEST_STATUS_OPTIONS = [
  { value: 'new', label: 'NEW' },
  { value: 'assigned', label: 'ASSIGNED' },
  { value: 'in_process', label: 'IN PROCESS' },
  { value: 'pending', label: 'PENDING' },
  { value: 'done', label: 'DONE' },
]

export const REQUEST_PRIORITY_OPTIONS = [
  { value: 'critical', label: 'CRITICAL' },
  { value: 'high', label: 'HIGH' },
  { value: 'medium', label: 'MEDIUM' },
  { value: 'low', label: 'LOW' },
]

export const isCompanyField = (field: RegistryField) => {
  const key = normalizeText(field.key)
  const label = normalizeText(field.label)
  const type = normalizeText(field.type)
  return (
    type === 'company_select' ||
    key === 'company' ||
    key === 'company_name' ||
    label.includes('company')
  )
}

export const isClientField = (field: RegistryField) => {
  const key = normalizeText(field.key)
  const label = normalizeText(field.label)
  const type = normalizeText(field.type)
  return (
    type === 'client_select' ||
    key === 'client' ||
    key === 'client_name' ||
    label.includes('client')
  )
}

export const isStatusField = (field: RegistryField) => {
  const key = normalizeText(field.key)
  const label = normalizeText(field.label)
  const type = normalizeText(field.type)
  return type === 'status_select' || key === 'status' || label === 'status' || label.includes('status')
}

export const isPriorityField = (field: RegistryField) => {
  const key = normalizeText(field.key)
  const label = normalizeText(field.label)
  const type = normalizeText(field.type)
  return type === 'priority_select' || key === 'priority' || label === 'priority' || label.includes('priority')
}

export const isDepartmentField = (field: RegistryField) => {
  const key = normalizeText(field.key)
  const label = normalizeText(field.label)
  const type = normalizeText(field.type)
  return (
    type === 'department_select' ||
    key === 'department_id' ||
    key === 'department' ||
    label === 'department' ||
    label.includes('department')
  )
}

const toClientName = (client: any) => {
  const first = (client?.first_name || '').trim()
  const last = (client?.last_name || '').trim()
  return `${first} ${last}`.trim()
}

const dedupe = (values: string[]) => Array.from(new Set(values.filter(Boolean)))

function useRegistryAutocomplete(currentUser: any) {
  const [companyNames, setCompanyNames] = useState<string[]>([])
  const [clientNames, setClientNames] = useState<string[]>([])

  useEffect(() => {
    const token = localStorage.getItem('crm_token')
    if (!token || !currentUser) {
      setCompanyNames([])
      setClientNames([])
      return
    }

    ;(async () => {
      try {
        const params = getWorkspaceParams(currentUser)
        const [companyRes, clientRes] = await Promise.all([
          axios.get('/registry/companies', {
            headers: { Authorization: `Bearer ${token}` },
            params,
          }),
          axios.get('/registry/clients', {
            headers: { Authorization: `Bearer ${token}` },
            params,
          }),
        ])

        const companies = Array.isArray(companyRes.data) ? companyRes.data : []
        const clients = Array.isArray(clientRes.data) ? clientRes.data : []

        setCompanyNames(dedupe(companies.map((company: any) => String(company?.name || '').trim())))
        setClientNames(dedupe(clients.map((client: any) => toClientName(client))))
      } catch {
        // Keep forms working even if registry endpoints are unavailable.
        setCompanyNames([])
        setClientNames([])
      }
    })()
  }, [currentUser?.id, currentUser?.workspace_id])

  return useMemo(
    () => ({
      companyNames,
      clientNames,
    }),
    [companyNames, clientNames],
  )
}

export default useRegistryAutocomplete
