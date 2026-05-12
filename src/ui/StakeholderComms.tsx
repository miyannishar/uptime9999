import { GameState } from '../sim/types';

interface StakeholderCommsProps {
  state: GameState;
  onRespond: (messageId: string, responseIndex: number) => void;
  onDismiss: (messageId: string) => void;
}

export default function StakeholderComms({ state, onRespond, onDismiss }: StakeholderCommsProps) {
  const activeMessages = state.stakeholderMessages.filter(
    m => !m.selectedResponse && m.expiresAt > Date.now()
  );

  if (activeMessages.length === 0) return null;

  return (
    <div className="stakeholder-comms">
      {activeMessages.slice(0, 3).map(msg => {
        const timeLeft = Math.max(0, Math.floor((msg.expiresAt - Date.now()) / 1000));
        const urgencyClass = timeLeft < 10 ? 'urgent' : timeLeft < 20 ? 'warning' : '';

        return (
          <div key={msg.id} className={`stakeholder-message ${urgencyClass}`}>
            <div className="stakeholder-header">
              <span className="stakeholder-avatar">{msg.icon}</span>
              <span className="stakeholder-name">{msg.character}</span>
              <span className="stakeholder-timer">{timeLeft}s</span>
              <button 
                className="stakeholder-dismiss" 
                onClick={() => onDismiss(msg.id)}
                title="Ignore (consequences apply)"
              >
                ✕
              </button>
            </div>
            <div className="stakeholder-body">
              <p>{msg.message}</p>
            </div>
            <div className="stakeholder-responses">
              {msg.responses.map((response, idx) => (
                <button
                  key={idx}
                  className="stakeholder-response-btn"
                  onClick={() => onRespond(msg.id, idx)}
                >
                  {response.text}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
