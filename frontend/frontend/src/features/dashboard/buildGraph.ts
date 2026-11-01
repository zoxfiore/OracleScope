import {
  CONTAINER_EXPLAIN,
  EXPLAIN,
  PROCESS_EXPLAIN,
  SGA_EXPLAIN,
  TABLESPACE_EXPLAIN,
} from './explanations.ts'
import { formatBytes, formatExactBytes } from './format.ts'
import type { Overview, Section } from './types.ts'

export interface DetailRow {
  label: string
  value: string
  kind: 'measured' | 'calculated'
}

export interface Details {
  title: string
  rows: DetailRow[]
  source: string
  collectedAt: string
  explanation: string
  extras?: { title: string; note?: string; rows: DetailRow[] }
  error?: string | null
}

export interface GraphItem {
  id: string
  parent: string | null
  edgeLabel?: string
  kicker: string
  title: string
  subtitle: string
  tone: 'root' | 'section' | 'leaf' | 'error'
  share?: number
  hasChildren?: boolean
  expanded?: boolean
  details: Details
}

export const ROOT_ID = 'instance'
export const DEFAULT_EXPANDED = ['sga', 'processes', 'sessions']

const CORE_PROCESSES = ['PMON', 'SMON', 'DBW0', 'LGWR', 'CKPT', 'RECO', 'ARC0', 'MMON']

const measured = (label: string, value: string | number): DetailRow => ({
  label,
  value: String(value),
  kind: 'measured',
})

const calculated = (label: string, value: string): DetailRow => ({
  label,
  value,
  kind: 'calculated',
})

const shortName = (name: string) => name.replace(/ Size$/, '')

function base(section: Section<unknown>, title: string, explanation: string): Details {
  return {
    title,
    rows: [],
    source: section.source,
    collectedAt: section.collected_at,
    explanation,
    error: section.error,
  }
}

export function buildGraph(overview: Overview, expanded: Set<string>): GraphItem[] {
  const items: GraphItem[] = []
  const add = (item: GraphItem) => items.push(item)
  const open = (id: string) => expanded.has(id)
  const { database, instance, sga, pga, sessions, processes, storage } = overview

  add({
    id: ROOT_ID,
    parent: null,
    kicker: 'Instance',
    title: instance.data?.instance_name ?? 'Instance',
    subtitle: instance.data ? `${instance.data.status} · ${instance.data.version_full}` : 'Unavailable',
    tone: instance.data ? 'root' : 'error',
    details: {
      ...base(instance, instance.data?.instance_name ?? 'Instance', EXPLAIN.instance),
      rows: instance.data
        ? [
            measured('Status', instance.data.status),
            measured('Version', instance.data.version_full),
            measured('Host', instance.data.host_name),
            measured('Started', instance.data.startup_time.replace('T', ' ')),
          ]
        : [],
    },
  })

  addMemory()
  addProcesses()
  addSessions()
  addDatabase()

  return items

  function addMemory() {
    add({
      id: 'sga',
      parent: ROOT_ID,
      kicker: 'Shared memory',
      title: 'SGA',
      subtitle: sga.data ? formatBytes(sga.data.total_bytes) : 'Unavailable',
      tone: sga.data ? 'section' : 'error',
      hasChildren: Boolean(sga.data),
      expanded: open('sga'),
      details: {
        ...base(sga, 'System Global Area (SGA)', EXPLAIN.sga),
        rows: sga.data
          ? [
              calculated('Total of components', formatExactBytes(sga.data.total_bytes)),
              ...sga.data.components.map((row) =>
                measured(shortName(row.name), formatExactBytes(row.bytes)),
              ),
            ]
          : [],
        extras: sga.data
          ? {
              title: 'Also reported by Oracle',
              note: EXPLAIN.sharedIoPool.replace('This row', 'Shared IO Pool'),
              rows: sga.data.other.map((row) =>
                measured(shortName(row.name), formatExactBytes(row.bytes)),
              ),
            }
          : undefined,
      },
    })

    if (sga.data && open('sga')) {
      const { components, total_bytes: total } = sga.data

      for (const row of components.filter((component) => component.bytes > 0)) {
        const share = row.bytes / total
        add({
          id: `sga:${row.name}`,
          parent: 'sga',
          kicker: 'SGA component',
          title: shortName(row.name),
          subtitle: formatBytes(row.bytes),
          tone: 'leaf',
          share,
          details: {
            ...base(sga, shortName(row.name), SGA_EXPLAIN[row.name] ?? EXPLAIN.sga),
            rows: [
              measured('Size', formatExactBytes(row.bytes)),
              measured('Resizeable', row.resizeable ?? 'Not reported'),
              calculated('Share of SGA', `${(share * 100).toFixed(1)}%`),
            ],
          },
        })
      }
    }

    const allocated = pga.data?.find((row) => row.name === 'total PGA allocated')
    add({
      id: 'pga',
      parent: ROOT_ID,
      kicker: 'Private memory',
      title: 'PGA',
      subtitle: allocated ? `${formatBytes(allocated.value)} allocated` : 'Unavailable',
      tone: pga.data ? 'section' : 'error',
      details: {
        ...base(pga, 'Program Global Area (PGA)', EXPLAIN.pga),
        rows: (pga.data ?? []).map((row) =>
          measured(row.name, row.unit === 'bytes' ? formatExactBytes(row.value) : row.value),
        ),
      },
    })
  }

  function addProcesses() {
    const data = processes.data

    add({
      id: 'processes',
      parent: ROOT_ID,
      kicker: 'Operating system',
      title: 'Processes',
      subtitle: data ? `${data.background_total + data.other_total} total` : 'Unavailable',
      tone: data ? 'section' : 'error',
      hasChildren: Boolean(data),
      expanded: open('processes'),
      details: {
        ...base(processes, 'Processes', EXPLAIN.processes),
        rows: data
          ? [
              measured('Background', data.background_total),
              measured('Other', data.other_total),
            ]
          : [],
      },
    })

    if (!data || !open('processes')) return

    add({
      id: 'background',
      parent: 'processes',
      kicker: 'Processes',
      title: 'Background',
      subtitle: `${data.background_total} running · click to expand`,
      tone: 'leaf',
      hasChildren: true,
      expanded: open('background'),
      details: {
        ...base(processes, 'Background processes', EXPLAIN.background),
        rows: [measured('Running', data.background_total)],
        extras: {
          title: 'All background processes',
          rows: data.background.map((process) =>
            measured(process.pname, `PID ${process.pid} · OS PID ${process.spid}`),
          ),
        },
      },
    })

    add({
      id: 'other-processes',
      parent: 'processes',
      kicker: 'Processes',
      title: 'Other',
      subtitle: `${data.other_total} running`,
      tone: 'leaf',
      details: {
        ...base(processes, 'Other processes', EXPLAIN.otherProcesses),
        rows: [measured('Running', data.other_total)],
      },
    })

    if (!open('background')) return

    for (const name of CORE_PROCESSES) {
      const process = data.background.find((candidate) => candidate.pname === name)
      if (!process) continue

      add({
        id: `process:${process.pid}`,
        parent: 'background',
        kicker: 'Background process',
        title: process.pname,
        subtitle: `PID ${process.pid}`,
        tone: 'leaf',
        details: {
          ...base(processes, process.pname, PROCESS_EXPLAIN[name]),
          rows: [
            measured('Oracle PID', process.pid),
            measured('OS process ID', process.spid),
            measured('Program', process.program),
          ],
        },
      })
    }
  }

  function addSessions() {
    const data = sessions.data
    const count = (type: string, status: string) =>
      data?.groups.find((group) => group.type === type && group.status === status)?.total ?? 0

    add({
      id: 'sessions',
      parent: ROOT_ID,
      kicker: 'Connections',
      title: 'Sessions',
      subtitle: data ? `${data.user_total + data.background_total} total` : 'Unavailable',
      tone: data ? 'section' : 'error',
      hasChildren: Boolean(data),
      expanded: open('sessions'),
      details: {
        ...base(sessions, 'Sessions', EXPLAIN.sessions),
        rows: data
          ? [measured('User', data.user_total), measured('Background', data.background_total)]
          : [],
      },
    })

    if (!data || !open('sessions')) return

    add({
      id: 'user-sessions',
      parent: 'sessions',
      kicker: 'Sessions',
      title: `User: ${data.user_total}`,
      subtitle: `${count('USER', 'ACTIVE')} active · ${count('USER', 'INACTIVE')} inactive`,
      tone: 'leaf',
      details: {
        ...base(sessions, 'User sessions', EXPLAIN.userSessions),
        rows: [
          measured('Active', count('USER', 'ACTIVE')),
          measured('Inactive', count('USER', 'INACTIVE')),
        ],
      },
    })

    add({
      id: 'background-sessions',
      parent: 'sessions',
      kicker: 'Sessions',
      title: `Background: ${data.background_total}`,
      subtitle: `${count('BACKGROUND', 'ACTIVE')} active`,
      tone: 'leaf',
      details: {
        ...base(sessions, 'Background sessions', EXPLAIN.backgroundSessions),
        rows: [measured('Total', data.background_total)],
      },
    })
  }

  function addDatabase() {
    add({
      id: 'database',
      parent: ROOT_ID,
      edgeLabel: 'opens',
      kicker: 'Database',
      title: database.data?.name ?? 'Database',
      subtitle: database.data?.open_mode ?? 'Unavailable',
      tone: database.data ? 'root' : 'error',
      details: {
        ...base(database, database.data?.name ?? 'Database', EXPLAIN.database),
        rows: database.data
          ? [
              measured('Open mode', database.data.open_mode),
              measured('Container database', database.data.cdb),
              measured('Log mode', database.data.log_mode),
              measured('Role', database.data.database_role),
            ]
          : [],
      },
    })

    if (!storage.data) {
      add({
        id: 'storage-error',
        parent: 'database',
        kicker: 'Storage',
        title: 'Containers',
        subtitle: 'Unavailable',
        tone: 'error',
        details: base(storage, 'Containers and storage', EXPLAIN.container),
      })
      return
    }

    for (const container of storage.data.containers) {
      const containerId = `container:${container.con_id}`

      add({
        id: containerId,
        parent: 'database',
        kicker: `Container ${container.con_id}`,
        title: container.name,
        subtitle: `${formatBytes(container.bytes)} · ${container.tablespaces.length} tablespaces`,
        tone: 'section',
        hasChildren: container.tablespaces.length > 0,
        expanded: open(containerId),
        details: {
          ...base(storage, container.name, CONTAINER_EXPLAIN[container.name] ?? EXPLAIN.container),
          rows: [
            measured('Container ID', container.con_id),
            ...(container.open_mode ? [measured('Open mode', container.open_mode)] : []),
            ...(container.total_size !== null
              ? [measured('Total size', formatExactBytes(container.total_size))]
              : []),
            calculated('Total of its files', formatExactBytes(container.bytes)),
          ],
        },
      })

      if (!open(containerId)) continue

      for (const tablespace of container.tablespaces) {
        const tablespaceId = `${containerId}:${tablespace.name}`

        add({
          id: tablespaceId,
          parent: containerId,
          kicker: tablespace.kind === 'temporary' ? 'Temporary tablespace' : 'Tablespace',
          title: tablespace.name,
          subtitle: formatBytes(tablespace.bytes),
          tone: 'leaf',
          hasChildren: tablespace.files.length > 0,
          expanded: open(tablespaceId),
          details: {
            ...base(
              storage,
              tablespace.name,
              TABLESPACE_EXPLAIN[tablespace.name] ?? EXPLAIN.tablespace,
            ),
            rows: [
              measured('Container', container.name),
              calculated('Total of its files', formatExactBytes(tablespace.bytes)),
              measured('Files', tablespace.files.length),
            ],
          },
        })

        if (!open(tablespaceId)) continue

        for (const file of tablespace.files) {
          add({
            id: `${tablespaceId}:${file.file_id}`,
            parent: tablespaceId,
            kicker: tablespace.kind === 'temporary' ? 'Temp file' : 'Data file',
            title: file.name.split('/').pop() ?? file.name,
            subtitle: formatBytes(file.bytes),
            tone: 'leaf',
            details: {
              ...base(storage, file.name.split('/').pop() ?? file.name, EXPLAIN.file),
              rows: [
                measured('Path', file.name),
                measured('Size', formatExactBytes(file.bytes)),
                measured('Status', file.status),
                measured('File number', file.file_id),
              ],
            },
          })
        }
      }
    }
  }
}
