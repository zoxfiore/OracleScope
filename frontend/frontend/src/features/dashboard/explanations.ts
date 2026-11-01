export const EXPLAIN = {
  instance:
    'An instance is the running part of Oracle: shared memory (SGA) and background processes. It starts first, then opens the database.',
  database:
    'The database is the stored part of Oracle: the files on disk. An instance opens it so that sessions can read and change its data.',
  sga: 'The System Global Area is memory shared by all of the instance’s processes. It is allocated when the instance starts.',
  pga: 'The Program Global Area is private memory that belongs to a single process. It holds work such as sorts and session data, and these figures are totals across all processes.',
  processes:
    'Oracle divides its work across operating system processes. V$PROCESS lists each one that Oracle knows about.',
  background:
    'Background processes do the instance’s shared work, such as writing to disk and recovering from failures. Some are always present, while numbered workers can vary.',
  otherProcesses:
    'V$PROCESS reports these without the background flag. This count is not the same as the number of user sessions.',
  sessions:
    'A session is the state Oracle keeps for one logged-in connection. A session is active while it is running a statement.',
  userSessions:
    'These sessions belong to connected clients. The count includes OracleScope’s own connection, which is active while it runs this query.',
  backgroundSessions: 'Oracle’s own background processes also have sessions.',
  container:
    'A container database holds several containers that share one instance. Each has its own tablespaces and data files.',
  tablespace:
    'A tablespace is a logical storage area. Oracle stores its contents in one or more files on disk.',
  file: 'This is a physical file on disk that stores the contents of a tablespace.',
  sharedIoPool:
    'This row is not in the total. Adding it would exceed the Maximum SGA Size, so it must overlap another area.',
}

export const SGA_EXPLAIN: Record<string, string> = {
  'Buffer Cache Size':
    'Holds copies of data blocks read from data files, so they can be reused without another disk read.',
  'Shared Pool Size':
    'Caches information that sessions can share, such as parsed SQL, execution plans and data dictionary details.',
  'Large Pool Size':
    'An optional area for large memory requests, such as those made by backup and parallel operations.',
  'Redo Buffers':
    'Holds records of changes until LGWR writes them to the online redo log files.',
  'Fixed SGA Size': 'A small internal area with general information about the state of the instance.',
}

export const PROCESS_EXPLAIN: Record<string, string> = {
  PMON: 'Process Monitor. Detects when a process fails so that its resources can be cleaned up.',
  SMON: 'System Monitor. Performs recovery when the instance starts and handles system-level cleanup.',
  DBW0: 'Database Writer. Writes modified blocks from the buffer cache to the data files.',
  LGWR: 'Log Writer. Writes the redo log buffer to the online redo log files, including when a transaction commits.',
  CKPT: 'Checkpoint. Records checkpoint information in the control files and data file headers.',
  RECO: 'Recoverer. Resolves distributed transactions that failed part way through.',
  ARC0: 'Archiver. Copies filled online redo logs to archive storage when the database is in ARCHIVELOG mode.',
  MMON: 'Manageability Monitor. Performs background tasks that collect statistics about the database.',
}

export const TABLESPACE_EXPLAIN: Record<string, string> = {
  SYSTEM: 'Stores the data dictionary, which describes everything in this container.',
  SYSAUX: 'An auxiliary tablespace that supports SYSTEM by storing data for many Oracle features.',
  UNDOTBS1: 'Stores undo data, used to roll back transactions and provide consistent reads.',
  TEMP: 'Stores temporary data, such as large sorts. It uses temp files instead of data files.',
  USERS: 'A default place for data created by database users.',
}

export const CONTAINER_EXPLAIN: Record<string, string> = {
  CDB$ROOT: 'The root container. It holds Oracle’s shared metadata and common users.',
  PDB$SEED: 'A read-only template that Oracle uses to create new pluggable databases.',
}
