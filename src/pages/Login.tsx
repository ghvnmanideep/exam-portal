import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../utils/auth';
import { Lock } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    // Mock authentication
    login(email);
    navigate('/dashboard');
  };

  return (
    <div className="flex-center full-screen bg-light">
      <div className="card login-card shadow">
        <div className="login-header">
          <div className="icon-circle bg-primary-light">
            <Lock className="icon-primary" size={24} />
          </div>
          <h2>Jozuna Login</h2>
          <p className="subtitle">Please sign in to continue</p>
        </div>
        
        {error && <div className="alert alert-error">{error}</div>}
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="student@example.com"
              className="form-control"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="form-control"
            />
          </div>
          
          <button type="submit" className="btn btn-primary w-full mt-4">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
