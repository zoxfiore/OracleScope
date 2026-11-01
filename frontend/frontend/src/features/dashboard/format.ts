const UNITS = ['bytes', 'KiB', 'MiB', 'GiB', 'TiB']

export function formatBytes(bytes: number) {
  let value = bytes
  let unit = 0

  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }

  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${UNITS[unit]}`
}

export function formatExactBytes(bytes: number) {
  return `${formatBytes(bytes)} (${bytes.toLocaleString('en-US')} bytes)`
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString()
}

export function formatNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '–' : value.toLocaleString('en-US')
}

export function formatDuration(microseconds: number | null | undefined) {
  if (microseconds === null || microseconds === undefined) return '–'
  if (microseconds < 1000) return `${microseconds} µs`
  if (microseconds < 1_000_000) return `${(microseconds / 1000).toFixed(1)} ms`
  return `${(microseconds / 1_000_000).toFixed(2)} s`
}
