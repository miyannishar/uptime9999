import { Architecture } from '../sim/types';

interface ArchMapProps {
  architecture: Architecture;
  onSelectNode: (id: string) => void;
  selectedNodeId: string | null;
}

export default function ArchMap({ architecture, onSelectNode, selectedNodeId }: ArchMapProps) {
  const { nodes, edges } = architecture;

  // Layout positions for nodes (hand-crafted for clarity)
  const positions: Record<string, { x: number; y: number }> = {
    dns: { x: 100, y: 50 },
    cdn: { x: 100, y: 150 },
    waf: { x: 100, y: 250 },
    glb: { x: 100, y: 350 },
    rlb: { x: 100, y: 450 },
    apigw: { x: 100, y: 550 },
    app: { x: 300, y: 550 },
    servicemesh: { x: 500, y: 550 },
    cache: { x: 500, y: 450 },
    queue: { x: 500, y: 650 },
    workers: { x: 700, y: 650 },
    db_primary: { x: 700, y: 450 },
    db_replica: { x: 700, y: 350 },
    storage: { x: 500, y: 750 },
    observability: { x: 300, y: 50 },
  };

  const getNodeStatus = (node: any): string => {
    if (!node.enabled) return 'disabled';
    if (node.operationalMode === 'down') return 'down';
    if (node.operationalMode === 'degraded') return 'degraded';
    if (node.utilization > 1.5) return 'overloaded';
    if (node.utilization > 0.8) return 'stressed';
    return 'normal';
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'normal': return '#00ff88';
      case 'stressed': return '#ffaa00';
      case 'overloaded': return '#ff6600';
      case 'degraded': return '#ff3366';
      case 'down': return '#ff0033';
      case 'disabled': return '#444444';
      default: return '#00ff88';
    }
  };

  return (
    <div className="arch-map">
      <div className="panel-header">
        <h2>🗺️ Architecture Map</h2>
      </div>

      <svg className="arch-svg" viewBox="0 0 850 850" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Render edges first */}
        {edges.map((edge, idx) => {
          const from = positions[edge.from];
          const to = positions[edge.to];
          if (!from || !to) return null;

          const fromNode = nodes.get(edge.from);
          const toNode = nodes.get(edge.to);
          if (!fromNode?.enabled || !toNode?.enabled) return null;

          return (
            <g key={`edge-${idx}`}>
              <line
                x1={from.x + 60}
                y1={from.y + 40}
                x2={to.x + 60}
                y2={to.y + 40}
                stroke="#00ffaa44"
                strokeWidth="2"
                strokeDasharray="4,4"
              />
            </g>
          );
        })}

        {/* Render nodes */}
        {Array.from(nodes.values()).map(node => {
          const pos = positions[node.id];
          if (!pos) return null;

          const status = getNodeStatus(node);
          const color = getStatusColor(status);
          const isSelected = selectedNodeId === node.id;
          const utilizationPercent = Math.min(100, (node.utilization * 100));
          const healthPercent = node.health * 100;

          return (
            <g
              key={node.id}
              onClick={() => onSelectNode(node.id)}
              style={{ cursor: 'pointer' }}
              className="node-group"
            >
              {/* Node box */}
              <rect
                x={pos.x}
                y={pos.y}
                width="120"
                height="80"
                fill="#1a1a2e"
                stroke={color}
                strokeWidth={isSelected ? 3 : 1.5}
                rx="4"
                filter={status === 'down' || status === 'degraded' ? 'url(#glow)' : ''}
              />

              {/* Node name */}
              <text
                x={pos.x + 60}
                y={pos.y + 20}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="12"
                fontWeight="bold"
              >
                {node.name}
              </text>

              {/* Utilization bar */}
              <rect
                x={pos.x + 10}
                y={pos.y + 30}
                width="100"
                height="8"
                fill="#333"
                rx="2"
              />
              <rect
                x={pos.x + 10}
                y={pos.y + 30}
                width={utilizationPercent}
                height="8"
                fill={utilizationPercent > 100 ? '#ff3366' : utilizationPercent > 80 ? '#ffaa00' : '#00ff88'}
                rx="2"
              />

              {/* Health bar */}
              <rect
                x={pos.x + 10}
                y={pos.y + 43}
                width="100"
                height="8"
                fill="#333"
                rx="2"
              />
              <rect
                x={pos.x + 10}
                y={pos.y + 43}
                width={healthPercent}
                height="8"
                fill={healthPercent < 30 ? '#ff3366' : healthPercent < 70 ? '#ffaa00' : '#00ff88'}
                rx="2"
              />

              {/* Status text */}
              <text
                x={pos.x + 60}
                y={pos.y + 65}
                textAnchor="middle"
                fill={color}
                fontSize="10"
                fontFamily="monospace"
              >
                {status.toUpperCase()}
              </text>

              {/* Instance count for scaled nodes */}
              {node.scaling.current > 1 && (
                <text
                  x={pos.x + 60}
                  y={pos.y + 75}
                  textAnchor="middle"
                  fill="#00ffaa"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  ×{node.scaling.current}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

