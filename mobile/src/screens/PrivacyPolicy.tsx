import LegalPage, { B, H2, Li, LegalLink, P, Ul } from '@/components/LegalPage';

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy">
      <P>
        MusicPromo AI (“we”, “us”, “our”) helps musicians plan campaigns and publish promotional
        content to social platforms. This Privacy Policy explains what information we collect, how we
        use it, and your choices. By using the app at{" "}
        <B>flying-sonic-promo-flow.base44.app</B>, you agree to
        this policy.
      </P>

      <H2>1. Information we collect</H2>
      <Ul>
        <Li>
          <B>Account data</B> — email, name, and authentication
          details when you register or sign in.
        </Li>
        <Li>
          <B>Campaign &amp; creative data</B> — songs, releases,
          captions, artwork, and video projects you upload or generate in the app.
        </Li>
        <Li>
          <B>Social connection data</B> — when you connect
          Instagram, TikTok, or YouTube, we store account identifiers, usernames, granted scopes, and
          encrypted access/refresh tokens needed to publish and read stats on your behalf.
        </Li>
        <Li>
          <B>Usage &amp; analytics</B> — publish history and
          performance metrics (views, likes, comments, shares) synced from platforms you connect, plus
          basic technical logs for reliability and security.
        </Li>
      </Ul>

      <H2>2. How we use information</H2>
      <Ul>
        <Li>Provide campaign planning, content generation, and social publishing features.</Li>
        <Li>Authenticate you and secure your account.</Li>
        <Li>Post content and fetch engagement metrics only after you connect a platform and grant permission.</Li>
        <Li>Improve reliability, debug errors, and prevent abuse.</Li>
        <Li>Comply with law and platform developer policies (Meta, TikTok, Google/YouTube).</Li>
      </Ul>

      <H2>3. Social platform access</H2>
      <P>
        We only request the OAuth scopes needed for the features you use (for example Instagram
        content publish, TikTok video upload/publish, YouTube upload and read). Tokens are encrypted at
        rest and are never exposed to the browser. You can disconnect a platform at any time in Social
        Hub; we then stop using that token for new actions.
      </P>

      <H2>4. Sharing</H2>
      <P>
        We do not sell your personal information. We share data only with: (a) infrastructure providers
        that host the app (including Base44); (b) social platforms when you authorize publishing or
        analytics; and (c) when required by law or to protect our rights and users.
      </P>

      <H2>5. Data retention</H2>
      <P>
        We retain account and campaign data while your account is active. Encrypted social tokens are
        kept until you disconnect or delete the connection. You may request deletion of your account
        data by contacting us; we will delete or anonymize personal data except where we must retain it
        for legal or security reasons.
      </P>

      <H2>6. Security</H2>
      <P>
        We use HTTPS in transit and encrypt social credentials at rest. No method of transmission or
        storage is 100% secure; please use a strong password and protect your login.
      </P>

      <H2>7. Children</H2>
      <P>
        MusicPromo AI is not directed to children under 13 (or the minimum age required in your
        jurisdiction). We do not knowingly collect personal information from children.
      </P>

      <H2>8. Your choices</H2>
      <Ul>
        <Li>Disconnect Instagram, TikTok, or YouTube from Social Hub.</Li>
        <Li>Update or delete campaign content you created.</Li>
        <Li>Contact us to request access, correction, or deletion of personal data.</Li>
      </Ul>

      <H2>9. International transfers</H2>
      <P>
        Your data may be processed in countries where our hosting providers operate. We take steps
        appropriate to the services we use to protect that data.
      </P>

      <H2>10. Changes</H2>
      <P>
        We may update this policy from time to time. The “Last updated” date at the bottom of this page
        will change when we do. Continued use of the app after changes means you accept the updated
        policy.
      </P>

      <H2>11. Contact</H2>
      <P>
        Questions about privacy: open Settings in the app or email{" "}
        <LegalLink href="mailto:support@flying-sonic-promo-flow.base44.app">
          support@flying-sonic-promo-flow.base44.app
        </LegalLink>
        .
      </P>
    </LegalPage>
  );
}
