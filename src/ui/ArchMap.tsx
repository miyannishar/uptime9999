import { useState, useRef, useEffect } from 'react';
import { Architecture, ActiveIncident } from '../sim/types';

interface ArchMapProps {
  architecture: Architecture;
  activeIncidents: ActiveIncident[];
  onSelectNode: (id: string) => void;
  selectedNodeId: string | null;
}

export default function ArchMap({ architecture, activeIncidents, onSelectNode, selectedNodeId }: ArchMapProps) {
  const { nodes, edges } = architecture;
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });

  // Layout positions for nodes (hand-crafted for clarity, scaled up significantly with more spacing)
  const positions: Record<string, { x: number; y: number }> = {
    dns: { x: 200, y: 100 },
    cdn: { x: 200, y: 340 },
    waf: { x: 200, y: 580 },
    glb: { x: 200, y: 820 },
    rlb: { x: 200, y: 1060 },
    apigw: { x: 200, y: 1300 },
    app: { x: 650, y: 1300 },
    servicemesh: { x: 1100, y: 1300 },
    cache: { x: 1100, y: 1060 },
    queue: { x: 1100, y: 1540 },
    workers: { x: 1550, y: 1540 },
    db_primary: { x: 1550, y: 1060 },
    db_replica: { x: 1550, y: 820 },
    storage: { x: 1100, y: 1780 },
    observability: { x: 650, y: 100 },
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

  // Handle wheel zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.3, Math.min(3, zoom * delta));
      setZoom(newZoom);
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => svg.removeEventListener('wheel', handleWheel);
  }, [zoom]);

  // Handle mouse drag for panning
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setLastPan(pan);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) {
      // Much higher sensitivity - multiply by 2 for very responsive dragging
      const deltaX = (e.clientX - dragStart.x) * 2;
      const deltaY = (e.clientY - dragStart.y) * 2;
      setPan({
        x: lastPan.x + deltaX,
        y: lastPan.y + deltaY,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  // Reset zoom/pan button
  const handleReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div className="arch-map" ref={containerRef}>
      <div className="panel-header">
        <h2>🗺️ Architecture Map</h2>
        <div className="map-controls">
          <button className="map-control-button" onClick={handleReset} title="Reset zoom/pan">
            🔍 Reset
          </button>
          <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      <svg 
        ref={svgRef}
        className="arch-svg" 
        viewBox="0 0 2000 2000" 
        xmlns="http://www.w3.org/2000/svg"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="scaleGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
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
                 x1={from.x + 150}
                 y1={from.y + 100}
                 x2={to.x + 150}
                 y2={to.y + 100}
                 stroke="#00ffaa44"
                 strokeWidth="5"
                 strokeDasharray="8,8"
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

          // Check if this node has active incidents
          const nodeIncidents = activeIncidents.filter(inc => inc.targetNodeId === node.id);
          const hasCritIncident = nodeIncidents.some(inc => inc.severity === 'CRIT');
          const hasWarnIncident = nodeIncidents.some(inc => inc.severity === 'WARN');

          return (
            <g
              key={node.id}
              onClick={() => onSelectNode(node.id)}
              style={{ cursor: 'pointer' }}
              className={`node-group ${status === 'degraded' ? 'node-degraded' : ''} ${status === 'down' ? 'node-down' : ''}`}
            >
              {/* Incident indicator glow */}
              {hasCritIncident && (
                <rect
                 x={pos.x - 8}
                 y={pos.y - 8}
                 width="316"
                 height="216"
                 fill="none"
                 stroke="#ff3366"
                 strokeWidth="8"
                 rx="12"
                 opacity="0.6"
                 className="incident-glow-crit"
                />
              )}
              {hasWarnIncident && !hasCritIncident && (
                <rect
                 x={pos.x - 6}
                 y={pos.y - 6}
                 width="312"
                 height="212"
                 fill="none"
                 stroke="#ffaa00"
                 strokeWidth="7"
                 rx="11"
                 opacity="0.5"
                 className="incident-glow-warn"
                />
              )}

              {/* Scaling glow (visible at all scaling levels) */}
              {node.scaling.current > 1 && (
                <rect
                 x={pos.x - 6}
                 y={pos.y - 6}
                 width={300 + 12}
                 height={200 + 12}
                 fill="none"
                 stroke="#00ffaa"
                 strokeWidth="6"
                 rx="11"
                 opacity={node.scaling.current > 5 ? 0.6 : 0.3}
                 className="scale-border-glow"
                />
              )}

              {/* Node box - grows slightly when scaled */}
              <rect
                x={pos.x}
                y={pos.y}
                width={300 + (node.scaling.current > 1 ? 6 : 0)}
                height={200 + (node.scaling.current > 1 ? 6 : 0)}
                fill="#1a1a2e"
                stroke={node.scaling.current > 1 ? '#00ffaa' : color}
                strokeWidth={isSelected ? 6 : (node.scaling.current > 1 ? 5 : 4)}
                rx="10"
                filter={status === 'down' || status === 'degraded' ? 'url(#glow)' : (node.scaling.current > 1 ? 'url(#scaleGlow)' : '')}
                className={node.scaling.current > 1 ? 'node-scaled-up' : ''}
              />

              {/* Node name */}
              <text
                x={pos.x + 150}
                y={pos.y + 50}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="28"
                fontWeight="bold"
              >
                {node.name}
              </text>

              {/* Utilization bar */}
              <rect
                x={pos.x + 30}
                y={pos.y + 78}
                width="240"
                height="22"
                fill="#333"
                rx="5"
              />
              <rect
                x={pos.x + 30}
                y={pos.y + 78}
                width={utilizationPercent * 2.4}
                height="22"
                fill={utilizationPercent > 100 ? '#ff3366' : utilizationPercent > 80 ? '#ffaa00' : '#00ff88'}
                rx="5"
              />

              {/* Health bar */}
              <rect
                x={pos.x + 30}
                y={pos.y + 110}
                width="240"
                height="22"
                fill="#333"
                rx="5"
              />
              <rect
                x={pos.x + 30}
                y={pos.y + 110}
                width={healthPercent * 2.4}
                height="22"
                fill={healthPercent < 30 ? '#ff3366' : healthPercent < 70 ? '#ffaa00' : '#00ff88'}
                rx="5"
              />

              {/* Metrics display - Health, Capacity, Utilization */}
              <g className="node-metrics">
                {/* Health metric */}
                <text
                  x={pos.x + 30}
                  y={pos.y + 152}
                  fill="#00ffaa"
                  fontSize="20"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  H:{Math.round(healthPercent)}%
                </text>
                
                {/* Capacity metric */}
                <text
                  x={pos.x + 150}
                  y={pos.y + 152}
                  fill="#00aaff"
                  fontSize="20"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  C:{Math.round(node.capacity / 1000)}k
                </text>
                
                {/* Utilization metric */}
                <text
                  x={pos.x + 270}
                  y={pos.y + 152}
                  fill={utilizationPercent > 80 ? '#ffaa00' : '#00ffaa'}
                  fontSize="20"
                  fontFamily="monospace"
                  textAnchor="end"
                  fontWeight="600"
                >
                  U:{Math.round(utilizationPercent)}%
                </text>
              </g>

              {/* Additional metrics row - Scaling, Errors, Latency */}
              <g className="node-metrics-secondary">
                {/* Scaling instances */}
                <text
                  x={pos.x + 30}
                  y={pos.y + 180}
                  fill="#00ffaa"
                  fontSize="18"
                  fontFamily="monospace"
                  fontWeight="600"
                >
                  ×{node.scaling.current}
                </text>
                
                {/* Error rate */}
                <text
                  x={pos.x + 150}
                  y={pos.y + 180}
                  fill={node.errorRate > 0.1 ? '#ff3366' : '#888'}
                  fontSize="18"
                  fontFamily="monospace"
                  textAnchor="middle"
                  fontWeight="600"
                >
                  E:{(node.errorRate * 100).toFixed(1)}%
                </text>
                
                {/* Latency */}
                <text
                  x={pos.x + 270}
                  y={pos.y + 180}
                  fill={node.latency > 500 ? '#ffaa00' : '#888'}
                  fontSize="18"
                  fontFamily="monospace"
                  textAnchor="end"
                  fontWeight="600"
                >
                  L:{Math.round(node.latency)}ms
                </text>
              </g>

              {/* Status text */}
              <text
                x={pos.x + 150}
                y={pos.y + 200}
                textAnchor="middle"
                fill={color}
                fontSize="22"
                fontFamily="monospace"
                fontWeight="700"
              >
                {status.toUpperCase()}
              </text>

              {/* Scaling badge indicator (when scaled) */}
              {node.scaling.current > 1 && (
                <>
                  {/* Background badge for scaling indicator */}
                  <rect
                    x={pos.x + 220}
                    y={pos.y + 15}
                    width="65"
                    height="32"
                    fill="#00ffaa"
                    opacity={node.scaling.current > 5 ? 0.4 : 0.25}
                    rx="14"
                    className={node.scaling.current > 1 ? 'scale-badge-glow' : ''}
                  />
                  {/* Scaling indicator icon */}
                  <text
                    x={pos.x + 252.5}
                    y={pos.y + 36}
                    textAnchor="middle"
                    fill="#00ffaa"
                    fontSize="22"
                    fontWeight="bold"
                    className="scale-icon"
                  >
                    ⬆
                  </text>
                </>
              )}

              {/* Health warning indicator */}
              {node.health < 0.5 && (
                <text
                  x={pos.x + 270}
                  y={pos.y + 32}
                  fontSize="28"
                  className="health-warning-icon"
                >
                  ⚠️
                </text>
              )}
            </g>
          );
        })}
        </g>
      </svg>
    </div>
  );
}

