<svelte:head>
  <title>Privacy Policy — Mapello</title>
  <meta name="description" content="Mapello privacy policy — what data we collect, how we use it, and your rights." />
  <link rel="preconnect" href="https://fonts.bunny.net" />
  <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700&display=swap" rel="stylesheet" />
  <link href="https://fonts.bunny.net/css?family=cormorant-garamond:400,400i,600,600i&display=swap" rel="stylesheet" />
</svelte:head>

<main class="prose-page">
  <div class="prose-container">
    <div class="prose-header">
      <span class="prose-tag">Legal</span>
      <h1>Privacy Policy</h1>
      <p class="prose-lead">Last updated: May 2026</p>
    </div>

    <div class="prose-body">
      <p>
        This policy describes what data Mapello collects, why, and how you can control it. We keep it short because there is not much to say: Mapello is a map editor, not an ad platform.
      </p>

      <h2>What we collect</h2>
      <h3>Account data</h3>
      <p>
        If you create an account (required to export more than 3 maps), we store your email address and a hashed password, or — if you use Google Sign-In — your Google account email and display name. We do not store your Google password.
      </p>

      <h3>Project data</h3>
      <p>
        If you save projects to the cloud, we store the project JSON on our servers (SQLite database). This data is yours; you can delete it at any time from your account settings.
      </p>

      <h3>Usage analytics</h3>
      <p>
        We use <a href="https://umami.is" target="_blank" rel="noopener noreferrer">Umami</a>, a privacy-focused analytics tool. It records anonymous page views and events (e.g. "export button clicked") with no cookies and no cross-site tracking. No personal data is associated with these events.
      </p>

      <h3>Billing data</h3>
      <p>
        Payments are handled by <a href="https://paddle.com" target="_blank" rel="noopener noreferrer">Paddle</a>, our payment processor. We do not store your credit card details. Paddle shares your transaction history with us for subscription management.
      </p>

      <h2>What we do not collect</h2>
      <ul>
        <li>We do not sell your data to anyone.</li>
        <li>We do not use tracking pixels or third-party ad cookies.</li>
        <li>We do not read or analyze the content of your maps.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Mapello sets one cookie: a session cookie used to keep you logged in. It contains no personal data beyond a session identifier and is deleted when you sign out.
      </p>

      <h2>Data retention and deletion</h2>
      <p>
        You can delete your account and all associated data from <a href="/account">your account settings</a>. Deletion is immediate and permanent. We do not retain backups of deleted accounts.
      </p>

      <h2>Your rights</h2>
      <p>
        Depending on where you live you may have rights to access, correct, or erase the personal data we hold about you. To exercise these rights, contact us at the address below.
      </p>

      <h2>Contact</h2>
      <p>
        Privacy questions: <a href="/contact">contact page</a> or by email at <a href="mailto:privacy@mapello.net">privacy@mapello.net</a>.
      </p>
    </div>
  </div>
</main>

<style>
  .prose-page {
    min-height: 100vh;
    background: #f5eedc;
    padding: 7rem 1.5rem 5rem;
    font-family: 'Inter', sans-serif;
  }
  .prose-container {
    max-width: 680px;
    margin: 0 auto;
  }
  .prose-header {
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid rgba(30, 41, 59, 0.1);
  }
  .prose-tag {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #c9943a;
    margin-bottom: 0.75rem;
  }
  h1 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 2.8rem;
    font-weight: 600;
    color: #0f172a;
    line-height: 1.15;
    margin: 0 0 1rem;
  }
  .prose-lead {
    font-size: 0.9rem;
    color: rgba(15, 23, 42, 0.45);
    margin: 0;
  }
  .prose-body h2 {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.45rem;
    font-weight: 600;
    color: #0f172a;
    margin: 2.5rem 0 0.75rem;
  }
  .prose-body h3 {
    font-size: 0.92rem;
    font-weight: 600;
    color: #0f172a;
    margin: 1.5rem 0 0.4rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .prose-body p,
  .prose-body li {
    font-size: 0.95rem;
    line-height: 1.75;
    color: rgba(15, 23, 42, 0.72);
  }
  .prose-body ul {
    padding-left: 1.4rem;
    margin: 0.5rem 0 1rem;
  }
  .prose-body li {
    margin-bottom: 0.4rem;
  }
  .prose-body a {
    color: #c9943a;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .prose-body a:hover {
    color: #a87730;
  }
</style>
