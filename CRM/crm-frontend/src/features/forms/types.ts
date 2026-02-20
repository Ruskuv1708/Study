export type FormField = {
  key: string
  label: string
  type: string
  required?: boolean
}

export type FormTemplate = {
  id: string
  name: string
  schema_structure: FormField[]
  meta_data?: Record<string, any> | null
}

export type RequestSettings = {
  enabled: boolean
  department_id?: string | null
  department_field_key?: string | null
  priority?: string
  title_template?: string | null
  description_template?: string | null
}

export type FormRecord = {
  id: string
  template_id: string
  entry_data: Record<string, any>
  created_at?: string
  updated_at?: string
}
