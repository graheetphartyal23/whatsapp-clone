import { useEffect, useState } from 'react';
import axios from 'axios';
import './UpdatesPage.css';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function formatTime(value) {
  if (!value) return '';
  const d = new Date(value);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UpdatesPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    axios
      .get(`${API}/api/announcements`, {
        headers: user?.token ? { Authorization: `Bearer ${user.token}` } : {},
      })
      .then((res) => {
        if (!cancelled) {
          setAnnouncements(res.data || []);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err?.response?.data?.message || 'Failed to load announcements.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.token]);

  return (
    <div className="updates-page">
      <header className="updates-header">
        <h2 className="updates-title">Updates</h2>
        <p className="updates-subtitle">Announcements that everyone can see.</p>
      </header>

      <section className="updates-list">
        {loading && <div className="updates-placeholder">Loading announcements…</div>}
        {error && !loading && <div className="updates-error">{error}</div>}
        {!loading && !error && announcements.length === 0 && (
          <div className="updates-placeholder">No announcements yet.</div>
        )}
        {!loading &&
          !error &&
          announcements.map((a) => (
            <article key={a.id} className="announcement-card">
              <div className="announcement-icon">📢</div>
              <div className="announcement-content">
                <p className="announcement-message">{a.message}</p>
                <time className="announcement-time" dateTime={a.createdAt}>
                  {formatTime(a.createdAt)}
                </time>
              </div>
            </article>
          ))}
      </section>
    </div>
  );
}

