// Drag and drop task - drag items to correct targets

import { useState } from 'react';

interface DragItem {
  id: string;
  label: string;
  correctTarget: string;
}

interface DropTarget {
  id: string;
  label: string;
  accepts: string[];
}

interface DragDropTaskProps {
  title: string;
  description: string;
  items: DragItem[];
  targets: DropTarget[];
  onComplete: () => void;
}

export default function DragDropTask({
  title,
  description,
  items,
  targets,
  onComplete,
}: DragDropTaskProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [placedItems, setPlacedItems] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleDragStart = (itemId: string) => {
    setDraggedItem(itemId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetId: string) => {
    if (!draggedItem) return;

    const item = items.find(i => i.id === draggedItem);
    if (!item) return;

    const target = targets.find(t => t.id === targetId);
    if (!target) return;

    // Check if correct
    if (item.correctTarget === targetId) {
      setPlacedItems({ ...placedItems, [draggedItem]: targetId });
      setError('');
      
      // Check if all items placed correctly
      const allCorrect = items.every(item => 
        placedItems[item.id] === item.correctTarget || 
        (draggedItem === item.id && targetId === item.correctTarget)
      );
      
      if (allCorrect && items.length === Object.keys({ ...placedItems, [draggedItem]: targetId }).length) {
        setSuccess(true);
        setTimeout(() => onComplete(), 1000);
      }
    } else {
      setError(`❌ "${item.label}" doesn't belong there. Try another target.`);
      setTimeout(() => setError(''), 2000);
    }

    setDraggedItem(null);
  };

  const getItemInTarget = (targetId: string) => {
    const itemId = Object.keys(placedItems).find(id => placedItems[id] === targetId);
    return items.find(i => i.id === itemId);
  };

  return (
    <div className="task-container drag-drop-task">
      <h3>🎯 {title}</h3>
      <p className="task-description">{description}</p>

      <div className="drag-drop-container">
        <div className="drag-items">
          <h4>Drag these items:</h4>
          {items.map(item => {
            const isPlaced = placedItems[item.id];
            return (
              <div
                key={item.id}
                className={`drag-item ${isPlaced ? 'placed' : ''} ${draggedItem === item.id ? 'dragging' : ''}`}
                draggable={!isPlaced}
                onDragStart={() => handleDragStart(item.id)}
              >
                {item.label}
                {isPlaced && <span className="placed-check">✓</span>}
              </div>
            );
          })}
        </div>

        <div className="drop-targets">
          <h4>Drop them here:</h4>
          {targets.map(target => {
            const item = getItemInTarget(target.id);
            const isCorrect = item && items.find(i => i.id === item.id)?.correctTarget === target.id;
            
            return (
              <div
                key={target.id}
                className={`drop-target ${item ? (isCorrect ? 'correct' : 'wrong') : ''}`}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(target.id)}
              >
                <div className="target-label">{target.label}</div>
                {item && (
                  <div className={`placed-item ${isCorrect ? 'correct' : 'wrong'}`}>
                    {item.label}
                  </div>
                )}
                {!item && <div className="drop-hint">Drop here</div>}
              </div>
            );
          })}
        </div>
      </div>

      {error && <div className="task-error">{error}</div>}
      {success && <div className="task-success">✅ All items placed correctly!</div>}
    </div>
  );
}

