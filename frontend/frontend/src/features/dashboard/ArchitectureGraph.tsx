import { useEffect, useMemo } from 'react'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
} from '@xyflow/react'
import type { Edge, Node, NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { GraphItem } from './buildGraph.ts'

const NODE_WIDTH = 216
const NODE_HEIGHT = 68
const COLUMN_GAP = 72
const ROW_GAP = 8

type OracleNode = Node<{ item: GraphItem; selected: boolean }, 'oracle'>

function OracleNodeView({ data: { item, selected } }: NodeProps<OracleNode>) {
  return (
    <div className={`graph-node graph-node-${item.tone}${selected ? ' is-selected' : ''}`}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="graph-node-top">
        <span className="graph-node-kicker">{item.kicker}</span>
        {item.hasChildren && (
          <span className="graph-node-toggle" aria-hidden="true">
            {item.expanded ? '−' : '+'}
          </span>
        )}
      </div>
      <div className="graph-node-title">{item.title}</div>
      <div className="graph-node-subtitle">{item.subtitle}</div>
      {item.share !== undefined && (
        <div className="graph-node-share" aria-hidden="true">
          <span style={{ width: `${Math.max(item.share * 100, 1)}%` }} />
        </div>
      )}
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  )
}

const NODE_TYPES = { oracle: OracleNodeView }

// Leaves take the next free row and each parent sits centred on its children,
// so nodes always appear in the order buildGraph lists them.
function layout(items: GraphItem[], selectedId: string) {
  const positions = new Map<string, { x: number; y: number }>()
  let nextRow = 0

  function place(item: GraphItem, depth: number): number {
    const children = items.filter((candidate) => candidate.parent === item.id)
    const rows = children.map((child) => place(child, depth + 1))
    const row = rows.length > 0 ? (rows[0] + rows[rows.length - 1]) / 2 : nextRow++

    positions.set(item.id, {
      x: depth * (NODE_WIDTH + COLUMN_GAP),
      y: row * (NODE_HEIGHT + ROW_GAP),
    })
    return row
  }

  items.filter((item) => !item.parent).forEach((item) => place(item, 0))

  const nodes: OracleNode[] = items.map((item) => ({
    id: item.id,
    type: 'oracle',
    position: positions.get(item.id)!,
    // The nodes are replaced on every update, so their fixed size is given here.
    width: NODE_WIDTH,
    height: NODE_HEIGHT,
    measured: { width: NODE_WIDTH, height: NODE_HEIGHT },
    data: { item, selected: item.id === selectedId },
  }))

  const edges: Edge[] = items
    .filter((item) => item.parent)
    .map((item) => ({
      id: `${item.parent}->${item.id}`,
      source: item.parent as string,
      target: item.id,
      type: 'smoothstep',
      label: item.edgeLabel,
      markerEnd: { type: MarkerType.ArrowClosed, color: '#b9b0ab' },
    }))

  return { nodes, edges }
}

function Graph({
  items,
  selectedId,
  onSelect,
}: {
  items: GraphItem[]
  selectedId: string
  onSelect: (item: GraphItem) => void
}) {
  const { fitView } = useReactFlow()
  const frameWidth = useStore((state) => state.width)
  const frameHeight = useStore((state) => state.height)
  const { nodes, edges } = useMemo(() => layout(items, selectedId), [items, selectedId])
  const shape = items.map((item) => item.id).join('|')

  // Refit when nodes appear or disappear or the frame resizes, but not when a
  // refresh only changes values.
  useEffect(() => {
    if (!frameWidth || !frameHeight) return

    const timer = setTimeout(() => fitView({ padding: 0.06 }), 60)
    return () => clearTimeout(timer)
  }, [shape, frameWidth, frameHeight, fitView])

  return (
    <ReactFlow<OracleNode, Edge>
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      onNodeClick={(_, node) => onSelect(node.data.item)}
      nodesDraggable={false}
      nodesConnectable={false}
      minZoom={0.15}
      maxZoom={1.25}
    >
      <Background color="#e6e2df" gap={22} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}

export function ArchitectureGraph(props: {
  items: GraphItem[]
  selectedId: string
  onSelect: (item: GraphItem) => void
}) {
  return (
    <ReactFlowProvider>
      <Graph {...props} />
    </ReactFlowProvider>
  )
}
