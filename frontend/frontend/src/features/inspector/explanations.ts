const OPERATIONS: Record<string, string> = {
  'SELECT STATEMENT': 'The top of the plan. It returns the finished rows to the client.',
  'TABLE ACCESS FULL':
    'Reads every block of the table and checks each row. This suits queries that need much of the table, but is wasteful for finding a few rows.',
  'TABLE ACCESS BY INDEX ROWID':
    'Fetches rows from the table using the row addresses (ROWIDs) supplied by an index.',
  'TABLE ACCESS BY INDEX ROWID BATCHED':
    'Fetches rows using ROWIDs from an index, grouping them so that several rows in one block are read together.',
  'INDEX RANGE SCAN':
    'Walks down the index tree to the first match, then reads along the index for the matching range of values.',
  'INDEX UNIQUE SCAN': 'Uses a unique index to find at most one matching row.',
  'INDEX FULL SCAN': 'Reads the whole index in order, one block at a time.',
  'INDEX FAST FULL SCAN':
    'Reads the whole index using multiblock reads. The rows are not returned in index order.',
  'SORT AGGREGATE': 'Combines the incoming rows into one summary row, for example for COUNT or SUM.',
  'SORT ORDER BY': 'Sorts the incoming rows to satisfy an ORDER BY.',
  'SORT GROUP BY': 'Sorts the incoming rows so that they can be combined into groups.',
  'SORT UNIQUE': 'Sorts the incoming rows and removes duplicates.',
  'HASH GROUP BY': 'Combines rows into groups using an in-memory hash table.',
  'HASH UNIQUE': 'Removes duplicate rows using an in-memory hash table.',
  'HASH JOIN':
    'Builds a hash table from one input, then probes it with each row from the other input.',
  'NESTED LOOPS': 'For each row from the first input, looks up the matching rows in the second input.',
  'MERGE JOIN': 'Joins two inputs that have been sorted on the join key.',
  FILTER: 'Discards rows that do not satisfy a condition.',
  VIEW: 'Treats the result of a subquery or view as a row source for its parent.',
  'COUNT STOPKEY': 'Stops reading once enough rows have been returned, for example with ROWNUM.',
  'FIXED TABLE FULL': 'Reads an Oracle internal memory structure, such as one behind a V$ view.',
}

export function explainOperation(operation: string, options: string | null) {
  return (
    OPERATIONS[options ? `${operation} ${options}` : operation] ??
    OPERATIONS[operation] ??
    'OracleScope has no description for this operation yet.'
  )
}

export const STATISTIC_LABELS: Record<string, string> = {
  'session logical reads': 'Logical reads',
  'physical reads': 'Physical reads',
  'redo size': 'Redo generated',
  'sorts (memory)': 'Sorts in memory',
  'sorts (disk)': 'Sorts on disk',
  'table scans (long tables)': 'Full scans of large tables',
  'parse count (hard)': 'Hard parses',
}

export const WAIT_EXPLAIN: Record<string, string> = {
  'db file sequential read': 'Read one block from disk, typically for an index or a row lookup.',
  'db file scattered read': 'Read several blocks from disk into the buffer cache.',
  'direct path read': 'Read blocks straight into private memory, bypassing the buffer cache.',
  'direct path write temp': 'Wrote data to the temporary tablespace because it did not fit in memory.',
  'log file sync': 'Waited for LGWR to confirm that redo was written to disk.',
  'SQL*Net message to client': 'Sent data to OracleScope over the network.',
  'events in waitclass Other': 'Oracle groups several minor internal waits under this name.',
}

export const BACKGROUND_EXPLAIN: Record<string, string> = {
  LGWR: 'Log Writer',
  LG00: 'Log Writer worker',
  LG01: 'Log Writer worker',
  DBW0: 'Database Writer',
  CKPT: 'Checkpoint',
  ARC0: 'Archiver',
}
