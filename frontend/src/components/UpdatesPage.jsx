import './UpdatesPage.css';
import './UpdatesPage.css';
import { useMemo } from 'react';

// Edit this string to change the global announcement
const GLOBAL_ANNOUNCEMENT_MESSAGE = `📢 Announcement
Voice Call 📞 and Video Call 🎥 are now available!
Enjoy smooth, high-quality calls designed to work seamlessly without lag.
Start a call from any chat and stay connected.`;

export default function UpdatesPage() {
  const announcement = useMemo(() => {
    const message = GLOBAL_ANNOUNCEMENT_MESSAGE?.trim();
    if (!message) return null;
    return {
      id: 'static-announcement', 
      message,
      createdAt: new Date().toISOString(),
    };
  }, []);

  return (
    <div className="updates-page">
      <header className="updates-header">
        <h2 className="updates-title">Updates</h2>
        <p className="updates-subtitle">Announcements that everyone can see.</p>
      </header>

      <section className="updates-list">
        {!announcement && (
          <div className="updates-placeholder">
            No announcement configured. Set GLOBAL_ANNOUNCEMENT_MESSAGE in UpdatesPage.jsx.
          </div>
        )}
        {announcement && (
          <article key={announcement.id} className="announcement-card">
            <div className="announcement-icon">📢</div>
            <div className="announcement-content">
              <p className="announcement-message">{announcement.message}</p>
              <time className="announcement-time" dateTime={announcement.createdAt}>
                {new Date(announcement.createdAt).toLocaleString()}
              </time>
            </div>
          </article>
        )}
      </section>
    </div>
  );
}

