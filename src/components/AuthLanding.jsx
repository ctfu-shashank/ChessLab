const QUOTES = [
  {
    name: 'Viswanathan Anand',
    title: '5-time World Champion · India',
    speciality: 'Speciality: Opening preparation, speed and versatility',
    quote: 'You need to motivate yourself, no matter what—definitely when things are bad, but also when things are good.',
    image: '/gm/viswanathan-anand.jpg',
    credit: 'Portrait provided for ChessLab',
  },
  {
    name: 'Mikhail Tal',
    title: '8th World Champion · 1960–1961',
    speciality: 'Speciality: Tactical attacks, initiative and sacrifices',
    quote: 'There are two types of sacrifices: correct ones and mine.',
    image: '/gm/mikhail-tal.webp',
    credit: 'Portrait provided for ChessLab',
  },
  {
    name: 'Bobby Fischer',
    title: '11th World Champion · 1972',
    speciality: 'Speciality: Calculation, precision and preparation',
    quote: 'I don’t believe in psychology. I believe in good moves.',
    image: '/gm/bobby-fischer.webp',
    credit: 'Portrait provided for ChessLab',
  },
  {
    name: 'Garry Kasparov',
    title: '13th World Champion · 1985–2000',
    speciality: 'Speciality: Dynamic attacking play and opening preparation',
    quote: 'If you wish to succeed, you must brave the risk of failure.',
    image: '/gm/garry-kasparov.jpg',
    credit: 'Portrait provided for ChessLab',
  },
  {
    name: 'Anatoly Karpov',
    title: '12th World Champion · 1975–1985',
    speciality: 'Speciality: Positional pressure and strategic technique',
    quote: 'Chess is everything: art, science, and sport.',
    image: '/gm/anatoly-karpov.webp',
    credit: 'Portrait provided for ChessLab',
  },
  {
    name: 'Magnus Carlsen',
    title: '5-time World Champion · Peak 2882',
    speciality: 'Speciality: Endgames, positional pressure and universal play',
    quote: 'Without the element of enjoyment, it is not worth trying to excel at anything.',
    image: '/gm/magnus-carlsen.webp',
    credit: 'Portrait provided for ChessLab',
  },
  {
    name: 'Hikaru Nakamura',
    title: 'Grandmaster · Elite rapid & blitz player',
    speciality: 'Speciality: Blitz, bullet, rapid calculation and practical play',
    quote: 'It hasn’t really sunk in yet, but it’s great to beat Magnus.',
    image: '/gm/hikaru-nakamura.webp',
    credit: 'Portrait provided for ChessLab',
  },
  {
    name: 'Gukesh D',
    title: 'World Champion · 2024–present',
    speciality: 'Speciality: Deep calculation, focus and handling pressure',
    quote: 'Just enjoy the game; chess is a beautiful game.',
    image: '/gm/gukesh-d.webp',
    credit: 'Portrait provided for ChessLab',
  },
];

const FEATURES = [
  ['♟', 'Deep Game Analysis', 'Stockfish-powered evaluation, best moves, accuracy and move classifications.'],
  ['◎', 'Game Review', 'Find your inaccuracies, mistakes and blunders and understand where the game changed.'],
  ['♞', 'Opening Academy', 'Study 20 popular openings with ideas, plans, variations and interactive boards.'],
  ['↗', 'Learn From Your Games', 'Save your games, revisit critical positions and turn mistakes into lessons.'],
];

export default function AuthLanding({ mode, setMode, form, setForm, error, busy, onSubmit }) {
  const isSignup = mode === 'signup';

  return (
    <div className="auth-page">
      <div className="auth-page-glow auth-glow-one" />
      <div className="auth-page-glow auth-glow-two" />

      <header className="auth-page-header">
        <div className="auth-brand">
          <div className="auth-brand-mark">♞</div>
          <div>
            <strong>ChessLab</strong>
            <span>Analyze · Learn · Improve</span>
          </div>
        </div>
        <div className="auth-header-note">Your personal chess workspace</div>
      </header>

      <main className="auth-page-main">
        <section className="auth-hero-copy">
          <div className="auth-kicker"><span /> BUILT FOR CHESS IMPROVEMENT</div>
          <h1>Don't just play the game.<br /><em>Understand it.</em></h1>
          <p className="auth-hero-text">
            ChessLab turns your games into lessons — combining engine analysis, accurate game review,
            opening study and practical insights in one focused workspace.
          </p>

          <div className="auth-feature-grid">
            {FEATURES.map(([icon, title, text]) => (
              <div className="auth-feature" key={title}>
                <div className="auth-feature-icon">{icon}</div>
                <div>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="auth-trust-row">
            <div><strong>Stockfish</strong><span>Engine analysis</span></div>
            <div><strong>Learn</strong><span>Popular openings</span></div>
            <div><strong>100%</strong><span>Focus on learning</span></div>
          </div>
        </section>

        <section className="auth-card-wrap">
          <div className="auth-card">
            <div className="auth-card-top">
              <div className="auth-card-icon">♞</div>
              <div>
                <span className="auth-eyebrow">WELCOME TO CHESSLAB</span>
                <h2>{isSignup ? 'Create your account' : 'Welcome back'}</h2>
              </div>
            </div>
            <p className="auth-card-subtitle">
              {isSignup ? 'Create your workspace and start turning games into lessons.' : 'Sign in to access your ChessLab workspace.'}
            </p>

            <div className="auth-tabs" role="tablist">
              <button className={!isSignup ? 'active' : ''} onClick={() => { setMode('login'); }} type="button">Log in</button>
              <button className={isSignup ? 'active' : ''} onClick={() => { setMode('signup'); }} type="button">Create account</button>
            </div>

            <form onSubmit={onSubmit} className="auth-page-form">
              {isSignup && (
                <label>
                  <span>Your name</span>
                  <input autoFocus value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Your name" autoComplete="name" />
                </label>
              )}
              <label>
                <span>Email address</span>
                <input autoFocus={!isSignup} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Your email address" autoComplete="email" />
              </label>
              <label>
                <span>Password</span>
                <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="At least 6 characters" autoComplete={isSignup ? 'new-password' : 'current-password'} />
              </label>

              {error && <div className="auth-page-error">{error}</div>}

              <button className="auth-page-submit" type="submit" disabled={busy}>
                {busy ? 'Opening your workspace…' : isSignup ? 'Create my ChessLab account →' : 'Enter ChessLab →'}
              </button>
            </form>

            <p className="auth-page-smallprint">
              This current project uses browser-local demo authentication. For a real deployment, connect this page to a secure authentication backend.
            </p>
          </div>
        </section>
      </main>

      <section className="master-section">
        <div className="master-section-heading">
          <div>
            <span className="auth-kicker"><span /> CHESS FROM THE CHAMPIONS</span>
            <h2>Learn from the champions.</h2>
          </div>
          <p>Quotes, milestones and playing strengths from eight chess champions.</p>
        </div>

        <div className="master-grid">
          {QUOTES.map((item) => (
            <article className="master-card" key={item.name}>
              <div className="master-photo-wrap">
                <img
                  src={item.image}
                  alt={`${item.name} portrait`}
                  className="master-photo"
                  loading="eager"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement.classList.add('photo-fallback');
                  }}
                />
                <div className="master-photo-shade" />
                <span className="master-title">{item.title}</span>
              </div>
              <div className="master-card-body">
                <div className="quote-mark">“</div>
                <blockquote>{item.quote}</blockquote>
                <div className="master-name">{item.name}</div>
                <div className="master-speciality">{item.speciality}</div>
              </div>
            </article>
          ))}
        </div>
        <div className="master-attribution">All eight portraits were provided for ChessLab.</div>
      </section>

      <footer className="auth-page-footer">
        <span>♟ ChessLab</span>
        <span>Analyze your games. Study your openings. Improve your decisions.</span>
      </footer>
    </div>
  );
}
