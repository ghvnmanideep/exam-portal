import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, logout } from '../utils/auth';
import { MonitorPlay, LogOut, CheckCircle, ShieldAlert } from 'lucide-react';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = getUser();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleStartExam = () => {
    window.open('/exam', '_blank');
  };

  return (
    <div className="layout-container bg-light">
      <nav className="navbar shadow-sm">
        <div className="navbar-brand">
          <MonitorPlay className="icon-primary" />
          <h1>Jozuna Assessment Portal</h1>
        </div>
        <div className="navbar-user">
          <span className="user-greeting">Welcome, {user?.name}</span>
          <button onClick={handleLogout} className="btn-icon">
            <LogOut size={20} />
            <span className="sr-only">Logout</span>
          </button>
        </div>
      </nav>

      <main className="dashboard-content">
        <div className="card full-width-card mt-8 shadow">
          <div className="card-body text-center">
            <div className="icon-circle lg-icon-circle bg-primary-light mx-auto mb-4">
              <CheckCircle className="icon-primary" size={48} />
            </div>
            <h2 className="mb-2">Ready for your Exam?</h2>
            <p className="text-muted mb-6">
              Before starting, please ensure you are in a quiet environment. 
              The system will request access to your camera and microphone. 
              Your face will be monitored automatically during the exam.
            </p>
            
            <div className="info-box mb-6 text-left">
              <h3>Exam Instructions:</h3>
              <ul className="instruction-list">
                <li>Duration: 30 minutes</li>
                <li>Do not switch tabs or leave the full-screen mode.</li>
                <li>Ensure your face is clearly visible to the camera.</li>
              </ul>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              <button onClick={handleStartExam} className="btn btn-primary btn-lg w-full max-w-sm">
                Start Exam
              </button>
              
              <button 
                onClick={() => navigate('/admin')} 
                className="btn w-full max-w-sm text-muted"
                style={{ backgroundColor: 'transparent', border: '1px solid var(--border-color)', gap: '0.5rem' }}
              >
                <ShieldAlert size={18} /> View Captures (Admin)
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
