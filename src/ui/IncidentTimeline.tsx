import { useRef, useEffect, useState } from 'react';
import { GameState } from '../sim/types';

interface IncidentTimelineProps {
  state: GameState;
}

export default function IncidentTimeline({ state }: IncidentTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const now = Date.now();
  const sessionStart = state.startTime;
  const sessionDuration = now - sessionStart;

  // Auto-scroll to the right only when the view is already pinned to the right edge.
  // If the user has dragged left, they're browsing history — don't snap back.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isDragging) return;
    const distFromRight = el.scrollWidth - el.clientWidth - el.scrollLeft;
    if (distFromRight < 40) {
      el.scrollLeft = el.scrollWidth;
    }
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    dragStartX.current = e.clientX;
    scrollStartX.current = scrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    scrollRef.current.scrollLeft = scrollStartX.current - (e.clientX - dragStartX.current);
  };

  const handleMouseUp = () => setIsDragging(false);

  // Combine active and historical incidents
  const allIncidents = [
    ...state.incidentHistory.map(h => ({
      id: h.id,
      name: h.name,
      severity: h.severity,
      targetNode: h.targetNode,
      startTime: h.startTime,
      endTime: h.endTime,
      active: false,
    })),
    ...state.activeIncidents.map(inc => ({
      id: inc.id,
      name: inc.aiGenerated ? ((inc as any).aiIncidentName || inc.id) : inc.definitionId?.replace(/_/g, ' '),
      severity: inc.severity,
      targetNode: inc.targetNodeId,
      startTime: inc.startTime,
      endTime: now,
      active: true,
    })),
  ];

  if (allIncidents.length === 0) {
    return (
      <div className="incident-timeline">
        <div className="timeline-header">
          <span className="timeline-title">Incident Timeline</span>
        </div>
        <div className="timeline-empty">No incidents yet</div>
      </div>
    );
  }

  // Calculate pixel scale: 1 pixel = 200ms
  const pixelsPerMs = 1 / 200;
  const timelineWidth = Math.max(600, sessionDuration * pixelsPerMs);

  const getSeverityColor = (severity: string, active: boolean) => {
    const alpha = active ? '1' : '0.6';
    switch (severity) {
      case 'CRIT': return `rgba(239, 68, 68, ${alpha})`;
      case 'WARN': return `rgba(234, 179, 8, ${alpha})`;
      case 'INFO': return `rgba(59, 130, 246, ${alpha})`;
      default: return `rgba(156, 163, 175, ${alpha})`;
    }
  };

  return (
    <div className="incident-timeline">
      <div className="timeline-header">
        <span className="timeline-title">Incident Timeline</span>
        <span className="timeline-stats">
          {state.incidentHistory.length} resolved · {state.activeIncidents.length} active
        </span>
      </div>
      <div
        className={`timeline-scroll${isDragging ? ' dragging' : ''}`}
        ref={scrollRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="timeline-track" style={{ width: `${timelineWidth}px` }}>
          {/* Time markers every 30 seconds */}
          {Array.from({ length: Math.floor(sessionDuration / 30000) + 1 }, (_, i) => {
            const time = i * 30000;
            return (
              <div
                key={`marker-${i}`}
                className="timeline-marker"
                style={{ left: `${time * pixelsPerMs}px` }}
              >
                <span className="timeline-marker-label">
                  {Math.floor(time / 60000)}:{String(Math.floor((time % 60000) / 1000)).padStart(2, '0')}
                </span>
              </div>
            );
          })}

          {/* Incident bars */}
          {allIncidents.map(inc => {
            const left = (inc.startTime - sessionStart) * pixelsPerMs;
            const width = Math.max(4, (inc.endTime - inc.startTime) * pixelsPerMs);

            return (
              <div
                key={inc.id}
                className={`timeline-incident ${inc.active ? 'active' : 'resolved'}`}
                style={{
                  left: `${left}px`,
                  width: `${width}px`,
                  backgroundColor: getSeverityColor(inc.severity, inc.active),
                }}
                title={`${inc.severity} | ${inc.name} | ${inc.targetNode}`}
              >
                {width > 50 && (
                  <span className="timeline-incident-label">{inc.name}</span>
                )}
              </div>
            );
          })}

          {/* Now marker */}
          <div
            className="timeline-now-marker"
            style={{ left: `${sessionDuration * pixelsPerMs}px` }}
          >
            <span className="timeline-now-label">NOW</span>
          </div>
        </div>
      </div>
    </div>
  );
}
