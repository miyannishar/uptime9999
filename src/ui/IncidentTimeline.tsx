import { useRef, useEffect, useState } from 'react';
import { GameState } from '../sim/types';

interface IncidentTimelineProps {
  state: GameState;
}

const LANE_HEIGHT = 22;   // px per lane
const BAR_HEIGHT  = 18;   // px height of each bar
const HEADER_H    = 28;   // px for time markers

export default function IncidentTimeline({ state }: IncidentTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const now = Date.now();
  const sessionStart = state.startTime;
  const sessionDuration = now - sessionStart;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || isDragging) return;
    const distFromRight = el.scrollWidth - el.clientWidth - el.scrollLeft;
    if (distFromRight < 40) el.scrollLeft = el.scrollWidth;
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

  const allIncidents = [
    ...state.incidentHistory.map(h => ({
      id: h.id, name: h.name, severity: h.severity,
      targetNode: h.targetNode, startTime: h.startTime, endTime: h.endTime, active: false,
    })),
    ...state.activeIncidents.map(inc => ({
      id: inc.id,
      name: inc.aiGenerated ? ((inc as any).aiIncidentName || inc.id) : inc.definitionId?.replace(/_/g, ' '),
      severity: inc.severity, targetNode: inc.targetNodeId,
      startTime: inc.startTime, endTime: now, active: true,
    })),
  ].sort((a, b) => a.startTime - b.startTime);

  if (allIncidents.length === 0) {
    return (
      <div className="incident-timeline">
        <div className="timeline-header"><span className="timeline-title">Incident Timeline</span></div>
        <div className="timeline-empty">No incidents yet</div>
      </div>
    );
  }

  const pixelsPerMs = 1 / 200;
  const timelineWidth = Math.max(600, sessionDuration * pixelsPerMs);

  // Assign each incident to the lowest free lane (no overlap)
  const laneEnds: number[] = [];   // laneEnds[lane] = rightmost endTime in that lane (px)
  const lanes: number[] = [];

  for (const inc of allIncidents) {
    const left = (inc.startTime - sessionStart) * pixelsPerMs;
    const width = Math.max(4, (inc.endTime - inc.startTime) * pixelsPerMs);
    const right = left + width;

    let lane = laneEnds.findIndex(end => end + 4 <= left);  // 4px gap
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = right;
    lanes.push(lane);
  }

  const numLanes = Math.max(1, laneEnds.length);
  const trackHeight = HEADER_H + numLanes * LANE_HEIGHT + 4;

  const sevColor = (s: string, active: boolean) => {
    const a = active ? '1' : '0.65';
    if (s === 'CRIT') return `rgba(239,68,68,${a})`;
    if (s === 'WARN') return `rgba(234,179,8,${a})`;
    return `rgba(59,130,246,${a})`;
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
        style={{ height: `${trackHeight}px` }}
      >
        <div className="timeline-track" style={{ width: `${timelineWidth}px`, height: `${trackHeight}px` }}>

          {/* Time markers */}
          {Array.from({ length: Math.floor(sessionDuration / 30000) + 1 }, (_, i) => {
            const t = i * 30000;
            return (
              <div key={`m${i}`} className="timeline-marker" style={{ left: `${t * pixelsPerMs}px` }}>
                <span className="timeline-marker-label">
                  {Math.floor(t / 60000)}:{String(Math.floor((t % 60000) / 1000)).padStart(2,'0')}
                </span>
              </div>
            );
          })}

          {/* Incident bars — each in its own lane */}
          {allIncidents.map((inc, i) => {
            const left  = (inc.startTime - sessionStart) * pixelsPerMs;
            const width = Math.max(4, (inc.endTime - inc.startTime) * pixelsPerMs);
            const top   = HEADER_H + lanes[i] * LANE_HEIGHT;
            return (
              <div
                key={inc.id}
                className={`timeline-incident ${inc.active ? 'active' : 'resolved'}`}
                style={{
                  left: `${left}px`, width: `${width}px`,
                  top: `${top}px`, height: `${BAR_HEIGHT}px`,
                  backgroundColor: sevColor(inc.severity, inc.active),
                  position: 'absolute',
                }}
                title={`${inc.severity} | ${inc.name} | ${inc.targetNode}`}
              >
                {width > 50 && <span className="timeline-incident-label">{inc.name}</span>}
              </div>
            );
          })}

          {/* NOW marker */}
          <div className="timeline-now-marker" style={{ left: `${sessionDuration * pixelsPerMs}px`, height: `${trackHeight}px` }}>
            <span className="timeline-now-label">NOW</span>
          </div>
        </div>
      </div>
    </div>
  );
}
