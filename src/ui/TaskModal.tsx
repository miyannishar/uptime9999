import { useState, useEffect, useRef } from 'react';
import { generateTask, TaskData } from '../services/taskGenerator';
import ConfigEditTask from './tasks/ConfigEditTask';
import LogSearchTask from './tasks/LogSearchTask';
import TerminalCommandTask from './tasks/TerminalCommandTask';
import CodeFixTask from './tasks/CodeFixTask';
import ButtonSequenceTask from './tasks/ButtonSequenceTask';
import DragDropTask from './tasks/DragDropTask';
import MultiChoiceTask from './tasks/MultiChoiceTask';
import InteractiveDiagramTask from './tasks/InteractiveDiagramTask';
import RealTimeMonitorTask from './tasks/RealTimeMonitorTask';

interface TaskModalProps {
  incidentName: string;
  incidentDescription: string;
  actionName: string;
  actionDescription: string;
  targetNode: string;
  onComplete: () => void;
  onClose: () => void;
}

export default function TaskModal({
  incidentName,
  incidentDescription,
  actionName,
  actionDescription,
  targetNode,
  onComplete,
  onClose,
}: TaskModalProps) {
  const [taskData, setTaskData] = useState<TaskData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [taskCompleted, setTaskCompleted] = useState(false);
  
  // Track if we've already generated a task for this combination
  const generatedTaskRef = useRef<string>('');
  const isMountedRef = useRef(true);
  const isGeneratingRef = useRef(false);

  useEffect(() => {
    // Create a unique key for this task request
    const taskKey = `${incidentName}|${actionName}|${targetNode}`;
    
    // If we've already generated a task for this exact combination, don't generate again
    if (generatedTaskRef.current === taskKey && taskData) {
      setIsLoading(false);
      return;
    }

    // Prevent concurrent generation requests
    if (isGeneratingRef.current) {
      return;
    }

    // Mark this task as being generated
    generatedTaskRef.current = taskKey;
    isGeneratingRef.current = true;
    isMountedRef.current = true;
    
    // Reset state
    setTaskData(null);
    setError(null);
    setIsLoading(true);

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
    if (!apiKey) {
      setError('OpenAI API key not found');
      setIsLoading(false);
      isGeneratingRef.current = false;
      return;
    }

    generateTask(
      incidentName,
      incidentDescription,
      actionName,
      actionDescription,
      targetNode,
      apiKey
    ).then((task) => {
      // Only update state if component is still mounted and this is still the current request
      if (!isMountedRef.current || generatedTaskRef.current !== taskKey) {
        return;
      }

      if (task) {
        setTaskData(task);
      } else {
        setError('Failed to generate task');
      }
      setIsLoading(false);
      isGeneratingRef.current = false;
    }).catch(() => {
      // Only update state if component is still mounted and this is still the current request
      if (!isMountedRef.current || generatedTaskRef.current !== taskKey) {
        return;
      }
      
      setError('Failed to generate task');
      setIsLoading(false);
      isGeneratingRef.current = false;
    });

    // Cleanup function
    return () => {
      isMountedRef.current = false;
      // Note: We can't cancel the fetch request, but we prevent state updates
    };
  }, [incidentName, incidentDescription, actionName, actionDescription, targetNode]);

  const handleTaskComplete = () => {
    setTaskCompleted(true);
    // Wait a moment to show success, then trigger the actual action
    setTimeout(() => {
      onComplete();
    }, 1000);
  };

  return (
    <div className="modal-overlay task-modal-overlay" onClick={onClose}>
      <div className="modal-content task-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div className="task-modal-header">
          <h2>🎯 Action Task</h2>
          <div className="task-context">
            <div><strong>Incident:</strong> {incidentName}</div>
            <div><strong>Action:</strong> {actionName}</div>
          </div>
        </div>

        <div className="task-modal-body">
          {isLoading && (
            <div className="task-loading">
              <div className="spinner"></div>
              <p>Generating interactive task...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="task-error-message">
              <p>Failed to generate task: {error}</p>
              <button className="task-submit-btn" onClick={onComplete}>
                Skip Task & Execute Action Anyway
              </button>
            </div>
          )}

          {!isLoading && !error && !taskData && (
            <div className="task-error-message">
              <p>⚠️ AI generated an invalid task (inconsistent data)</p>
              <p className="task-hint">This happens when the AI makes mistakes. Skipping the interactive task...</p>
              <button className="task-submit-btn" onClick={onComplete}>
                Execute Action Directly
              </button>
            </div>
          )}

          {taskData && !taskCompleted && (
            <div className="task-content">
              {taskData.type === 'config' && (
                <ConfigEditTask
                  {...taskData.data}
                  onComplete={handleTaskComplete}
                />
              )}

              {taskData.type === 'log' && (
                <LogSearchTask
                  {...taskData.data}
                  onComplete={handleTaskComplete}
                />
              )}

              {taskData.type === 'terminal' && (
                <TerminalCommandTask
                  {...taskData.data}
                  onComplete={handleTaskComplete}
                />
              )}

              {taskData.type === 'code' && (
                <CodeFixTask
                  {...taskData.data}
                  validateFix={(code: string) => {
                    // Check that bugPattern is NOT present (bug was fixed)
                    const bugRemoved = !code.includes(taskData.data.bugPattern);
                    // Also check that code was actually changed
                    const codeChanged = code !== taskData.data.code;
                    return bugRemoved && codeChanged;
                  }}
                  onComplete={handleTaskComplete}
                />
              )}

              {taskData.type === 'button-sequence' && (
                <ButtonSequenceTask
                  {...taskData.data}
                  onComplete={handleTaskComplete}
                />
              )}

              {taskData.type === 'drag-drop' && (
                <DragDropTask
                  {...taskData.data}
                  onComplete={handleTaskComplete}
                />
              )}

              {taskData.type === 'multi-choice' && (
                <MultiChoiceTask
                  {...taskData.data}
                  onComplete={handleTaskComplete}
                />
              )}

              {taskData.type === 'diagram' && (
                <InteractiveDiagramTask
                  {...taskData.data}
                  onComplete={handleTaskComplete}
                />
              )}

              {taskData.type === 'monitor' && (
                <RealTimeMonitorTask
                  {...taskData.data}
                  onComplete={handleTaskComplete}
                />
              )}
            </div>
          )}

          {taskCompleted && (
            <div className="task-success">
              <div className="success-icon">✅</div>
              <p>Task completed! Executing action...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

