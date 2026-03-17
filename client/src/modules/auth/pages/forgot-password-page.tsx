import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../../../api/auth-api';

// Extracted to its own module so the router can lazy-load it as a separate
// chunk — it is rarely visited and should not bloat the main router bundle.
export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <h2 className="text-2xl font-bold text-gray-900 text-center">Forgot Password</h2>
        {sent ? (
          <div className="card text-center space-y-4">
            <p className="text-gray-700">
              If that email exists, a reset link has been sent.
            </p>
            <Link to="/login" className="text-primary-600 hover:underline text-sm">
              Back to login
            </Link>
          </div>
        ) : (
          <form className="card space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="form-label">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                placeholder="you@example.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white py-2 rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <Link to="/login" className="block text-center text-sm text-primary-600 hover:underline">
              Back to login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
