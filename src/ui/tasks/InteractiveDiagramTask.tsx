// Interactive diagram task - click nodes/components to configure

import { useState } from 'react';

interface DiagramNode {
  id: string;
  label: string;
  type: 'component' | 'connection' | 'config';
  x: number;
  y: number;
  status: 'normal' | 'warning' | 'error';
  requiredAction?: string;
  correctAction?: string;
}

interface InteractiveDiagramTaskProps {
  title: string;
  description: string;
  nodes: DiagramNode[];
  onComplete: () => void;
}

export default function InteractiveDiagramTask({
  title,
  description,
  nodes,
  onComplete,
}: InteractiveDiagramTaskProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [fixedNodes, setFixedNodes] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const handleNodeClick = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setSelectedNode(nodeId);

    if (node.requiredAction && node.correctAction) {
      // Show action options
      // For now, just check if clicking fixes it
      if (node.status !== 'normal') {
        setFixedNodes(new Set([...fixedNodes, nodeId]));
        setError('');
        
        // Check if all nodes fixed
        const allFixed = nodes.every(n => 
          n.status === 'normal' || fixedNodes.has(n.id) || n.id === nodeId
        );
        
        if (allFixed) {
          setTimeout(() => onComplete(), 1000);
        }
      }
    }
  };

  const getNodeColor = (node: DiagramNode) => {
    if (fixedNodes.has(node.id)) return '#00ffaa';
    if (node.status === 'error') return '#ff3366';
    if (node.status === 'warning') return '#ffaa00';
    return '#00aaff';
  };

  return (
    <div className="task-container diagram-task">
      <h3>🗺️ {title}</h3>
      <p className="task-description">{description}</p>

      <div className="diagram-container">
        <svg viewBox="0 0 800 600" className="diagram-svg">
          {/* Draw connections first */}
          {nodes.filter(n => n.type === 'connection').map(node => (
            <line
              key={node.id}
              x1={node.x}
              y1={node.y}
              x2={node.x + 100}
              y2={node.y}
              stroke="#00ffaa44"
              strokeWidth="2"
            />
          ))}

          {/* Draw nodes */}
          {nodes.filter(n => n.type !== 'connection').map(node => {
            const isSelected = selectedNode === node.id;
            const isFixed = fixedNodes.has(node.id);
            
            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isSelected ? 35 : 30}
                  fill={getNodeColor(node)}
                  stroke={isSelected ? '#ffffff' : '#00ffaa'}
                  strokeWidth={isSelected ? 3 : 2}
                  className="diagram-node"
                  onClick={() => handleNodeClick(node.id)}
                  style={{ cursor: 'pointer' }}
                />
                <text
                  x={node.x}
                  y={node.y + 5}
                  textAnchor="middle"
                  fill="#0a0a0f"
                  fontSize="12"
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {node.label}
                </text>
                {isFixed && (
                  <text
                    x={node.x}
                    y={node.y - 40}
                    textAnchor="middle"
                    fill="#00ffaa"
                    fontSize="20"
                    pointerEvents="none"
                  >
                    ✓
                  </text>
                )}
                {node.status === 'error' && !isFixed && (
                  <text
                    x={node.x}
                    y={node.y - 40}
                    textAnchor="middle"
                    fill="#ff3366"
                    fontSize="16"
                    pointerEvents="none"
                  >
                    ⚠️
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {selectedNode && (
        <div className="node-details">
          {(() => {
            const node = nodes.find(n => n.id === selectedNode);
            if (!node) return null;
            
            return (
              <>
                <h4>{node.label}</h4>
                {node.requiredAction && (
                  <div className="action-prompt">
                    <p><strong>Action Required:</strong> {node.requiredAction}</p>
                    {node.correctAction && (
                      <button
                        className="action-button"
                        onClick={() => {
                          if (node.correctAction) {
                            setFixedNodes(new Set([...fixedNodes, node.id]));
                            setSelectedNode(null);
                          }
                        }}
                      >
                        {node.correctAction}
                      </button>
                    )}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {error && <div className="task-error">{error}</div>}

      <div className="task-hint">
        <p>💡 Click on the highlighted components to fix them</p>
      </div>
    </div>
  );
}

