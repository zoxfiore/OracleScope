export interface Section<T> {
  status: 'ok' | 'error'
  source: string
  collected_at: string
  data: T | null
  error: string | null
}

export interface SgaRow {
  name: string
  bytes: number
  resizeable: string | null
}

export interface PgaRow {
  name: string
  value: number
  unit: string | null
}

export interface OracleProcess {
  pid: number
  pname: string
  spid: string
  program: string
}

export interface StorageFile {
  file_id: number
  name: string
  bytes: number
  status: string
}

export interface Tablespace {
  name: string
  kind: 'permanent' | 'temporary'
  bytes: number
  files: StorageFile[]
}

export interface Container {
  con_id: number
  name: string
  open_mode: string | null
  total_size: number | null
  bytes: number
  tablespaces: Tablespace[]
}

export interface Overview {
  database: Section<{
    name: string
    cdb: string
    open_mode: string
    log_mode: string
    database_role: string
  }>
  instance: Section<{
    instance_name: string
    host_name: string
    version_full: string
    status: string
    startup_time: string
  }>
  sga: Section<{
    components: SgaRow[]
    other: SgaRow[]
    total_bytes: number
  }>
  pga: Section<PgaRow[]>
  sessions: Section<{
    groups: { type: string; status: string; total: number }[]
    user_total: number
    background_total: number
  }>
  processes: Section<{
    background: OracleProcess[]
    background_total: number
    other_total: number
  }>
  storage: Section<{ containers: Container[] }>
}
