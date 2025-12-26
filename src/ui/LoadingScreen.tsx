import './LoadingScreen.css';

export default function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <h1>⚡ UPTIME 99.99</h1>
        </div>
        <div className="loading-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        <div className="loading-text">
          <p className="loading-title">Initializing The Game Master...</p>
          <p className="loading-subtitle">Preparing your infrastructure simulation</p>
        </div>
      </div>
    </div>
  );
}

