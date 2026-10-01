import LegalPage from "@/components/LegalPage";

/**
 * Public Privacy Policy — required for TikTok / Google / Meta app review.
 * URL: https://flying-sonic-promo-flow.base44.app/privacy
 */
export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        MusicPromo AI (“we”, “us”, “our”) helps musicians plan campaigns and publish promotional
        content to social platforms. This Privacy Policy explains what information we collect, how we
        use it, and your choices. By using the app at{" "}
        <strong className="text-foreground">flying-sonic-promo-flow.base44.app</strong>, you agree to
        this policy.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>
          <strong className="text-foreground">Account data</strong> — email, name, and authentication
          details when you register or sign in.
        </li>
        <li>
          <strong className="text-foreground">Campaign &amp; creative data</strong> — songs, releases,
          captions, artwork, and video projects you upload or generate in the app.
        </li>
        <li>
          <strong className="text-foreground">Social connection data</strong> — when you connect
          Instagram, TikTok, or YouTube, we store account identifiers, usernames, granted scopes, and
          encrypted access/refresh tokens needed to publish and read stats on your behalf.
        </li>
        <li>
          <strong className="text-foreground">Usage &amp; analytics</strong> — publish history and
          performance metrics (views, likes, comments, shares) synced from platforms you connect, plus
          basic technical logs for reliability and security.
        </li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>Provide campaign planning, content generation, and social publishing features.</li>
        <li>Authenticate you and secure your account.</li>
        <li>Post content and fetch engagement metrics only after you connect a platform and grant permission.</li>
        <li>Improve reliability, debug errors, and prevent abuse.</li>
        <li>Comply with law and platform developer policies (Meta, TikTok, Google/YouTube).</li>
      </ul>

      <h2>3. Social platform access</h2>
      <p>
        We only request the OAuth scopes needed for the features you use (for example Instagram
        content publish, TikTok video upload/publish, YouTube upload and read). Tokens are encrypted at
        rest and are never exposed to the browser. You can disconnect a platform at any time in Social
        Hub; we then stop using that token for new actions.
      </p>

      <h2>4. Sharing</h2>
      <p>
        We do not sell your personal information. We share data only with: (a) infrastructure providers
        that host the app (including Base44); (b) social platforms when you authorize publishing or
        analytics; and (c) when required by law or to protect our rights and users.
      </p>

      <h2>5. Data retention</h2>
      <p>
        We retain account and campaign data while your account is active. Encrypted social tokens are
        kept until you disconnect or delete the connection. You may request deletion of your account
        data by contacting us; we will delete or anonymize personal data except where we must retain it
        for legal or security reasons.
      </p>

      <h2>6. Security</h2>
      <p>
        We use HTTPS in transit and encrypt social credentials at rest. No method of transmission or
        storage is 100% secure; please use a strong password and protect your login.
      </p>

      <h2>7. Children</h2>
      <p>
        MusicPromo AI is not directed to children under 13 (or the minimum age required in your
        jurisdiction). We do not knowingly collect personal information from children.
      </p>

      <h2>8. Your choices</h2>
      <ul>
        <li>Disconnect Instagram, TikTok, or YouTube from Social Hub.</li>
        <li>Update or delete campaign content you created.</li>
        <li>Contact us to request access, correction, or deletion of personal data.</li>
      </ul>

      <h2>9. International transfers</h2>
      <p>
        Your data may be processed in countries where our hosting providers operate. We take steps
        appropriate to the services we use to protect that data.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy from time to time. The “Last updated” date at the bottom of this page
        will change when we do. Continued use of the app after changes means you accept the updated
        policy.
      </p>

      <h2>11. Contact</h2>
      <p>
        Questions about privacy: open Settings in the app or email{" "}
        <a className="underline hover:text-foreground" href="mailto:support@flying-sonic-promo-flow.base44.app">
          support@flying-sonic-promo-flow.base44.app
        </a>
        .
      </p>
    </LegalPage>
  );
}
