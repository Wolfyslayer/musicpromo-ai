import LegalPage from "@/components/LegalPage";
import SupportEmailLink from "@/components/SupportEmailLink";
import { PRIMARY_APP_ORIGIN, PUBLIC_APP_ORIGINS } from "@/content/publicAppUrls";

/**
 * Public Privacy Policy — OAuth app review (Meta/Instagram, TikTok, Google/YouTube, X).
 */
export default function PrivacyPolicy() {
  const originsList = PUBLIC_APP_ORIGINS.join(", ");

  return (
    <LegalPage title="Privacy Policy">
      <p>
        MusicPromo AI (“<strong className="text-foreground">MusicPromo AI</strong>”, “we”, “us”, “our”)
        helps musicians and teams plan release campaigns, create promotional media, and publish to social
        networks they connect. This Privacy Policy describes how we collect, use, store, and share
        information when you use our web application (including{" "}
        <strong className="text-foreground">{originsList}</strong> and any successor domain we publish).
        By using the Service, you agree to this policy.
      </p>

      <h2 id="information-we-collect">1. Information we collect</h2>
      <ul>
        <li>
          <strong className="text-foreground">Account &amp; identity</strong> — email address, display
          name, handle, profile photo, timezone, and authentication data when you register, sign in (including
          email/password or Google Sign-In), or update your profile.
        </li>
        <li>
          <strong className="text-foreground">Campaign &amp; creative data</strong> — artist and release
          metadata, songs, lyrics, artwork, audio files, video projects, captions, hooks, hashtags, campaign
          calendars, and content you upload or generate in the app.
        </li>
        <li>
          <strong className="text-foreground">Social connection data</strong> — when you connect a social
          account, we store platform identifiers (e.g. Instagram user ID, TikTok open ID, YouTube channel ID,
          X user ID), usernames/display names, profile images, granted OAuth scopes, token expiry metadata,
          and encrypted access and refresh tokens used only to perform actions you request.
        </li>
        <li>
          <strong className="text-foreground">Publishing &amp; scheduling</strong> — records of drafts,
          scheduled posts, publish status, error messages, permalinks, and media URLs associated with posts you
          queue or publish through the Service.
        </li>
        <li>
          <strong className="text-foreground">Analytics &amp; performance</strong> — engagement metrics (such
          as views, likes, comments, and shares) synced from connected platforms for posts linked to your
          campaigns, plus in-app analytics you view in dashboards.
        </li>
        <li>
          <strong className="text-foreground">Billing</strong> — if you subscribe or purchase credits,
          payment is processed by our payment provider (e.g. Stripe). We receive subscription status and
          customer identifiers, not full card numbers.
        </li>
        <li>
          <strong className="text-foreground">Support &amp; communications</strong> — messages you send to
          support, optional AI-assisted support chat content, and email delivery metadata.
        </li>
        <li>
          <strong className="text-foreground">Device &amp; push (optional)</strong> — if you enable mobile
          push notifications, we store a device push token and your notification preferences.
        </li>
        <li>
          <strong className="text-foreground">Community (optional)</strong> — if you use community features,
          public profile fields you choose to show, follow relationships, and reports you submit.
        </li>
        <li>
          <strong className="text-foreground">Technical logs</strong> — IP address, browser type, timestamps,
          and diagnostic logs used for security, abuse prevention, and reliability. We do not use these logs
          to sell advertising profiles.
        </li>
      </ul>

      <h2>2. How we use information</h2>
      <ul>
        <li>Provide campaign planning, AI-assisted copy and media tools, video preparation, and publishing.</li>
        <li>Authenticate you, maintain your session, and secure your account.</li>
        <li>
          Connect to third-party social platforms <strong className="text-foreground">only after you
          initiate OAuth</strong> and publish or schedule content <strong className="text-foreground">only
          when you ask us to</strong> (including campaign auto-publish you enable per day).
        </li>
        <li>Sync engagement statistics for connected accounts and posts you published through the Service.</li>
        <li>Process subscriptions, credits, and support requests.</li>
        <li>Send optional email or push digests you opt into (e.g. launch or daily stats notifications).</li>
        <li>Improve the Service, debug errors, and comply with law and platform developer policies.</li>
      </ul>

      <h2>3. Legal bases (EEA/UK users)</h2>
      <p>
        Where applicable, we process personal data on the basis of: (a) performance of our contract with you
        (providing the Service); (b) your consent (e.g. connecting social accounts, marketing emails, push
        notifications); (c) legitimate interests (security, fraud prevention, product improvement); and (d)
        legal obligations.
      </p>

      <h2 id="social-platforms">4. Third-party social platforms</h2>
      <p>
        Connecting a social account is <strong className="text-foreground">optional</strong>. Each platform’s
        own privacy policy and terms apply in addition to this Policy. We access platform data only through
        official APIs and the scopes shown to you in the authorization screen. OAuth tokens are encrypted at
        rest, used server-side only, and are not exposed to other users or in the browser. You can disconnect
        any platform in <strong className="text-foreground">Social Hub → Connect</strong>; we stop using that
        token for new API calls after disconnect (subject to retention below).
      </p>

      <h3>4.1 Instagram (Meta)</h3>
      <p>
        We use Instagram Login for Business to connect your Instagram professional account and, with your
        permission, publish content (e.g. Reels/feed) and read basic profile information needed to display
        your connected account. Typical permissions include{" "}
        <code className="text-xs text-foreground">instagram_business_basic</code> and{" "}
        <code className="text-xs text-foreground">instagram_business_content_publish</code>. We do not sell
        Instagram data. You can revoke access in Instagram/Meta account settings or by disconnecting in the
        app. See{" "}
        <a
          className="underline hover:text-foreground"
          href="https://www.facebook.com/privacy/policy/"
          target="_blank"
          rel="noreferrer"
        >
          Meta Privacy Policy
        </a>
        .
      </p>

      <h3>4.2 TikTok</h3>
      <p>
        We use TikTok Login Kit and Content Posting API to connect your TikTok account, show your profile in
        Social Hub, upload and publish videos you create in the app, and list/read metadata for videos you
        published through us (for status and analytics). Typical scopes include{" "}
        <code className="text-xs text-foreground">user.info.basic</code>,{" "}
        <code className="text-xs text-foreground">user.info.profile</code>,{" "}
        <code className="text-xs text-foreground">video.upload</code>,{" "}
        <code className="text-xs text-foreground">video.publish</code>, and{" "}
        <code className="text-xs text-foreground">video.list</code>. We do not post without your explicit
        publish or schedule action. See{" "}
        <a
          className="underline hover:text-foreground"
          href="https://www.tiktok.com/legal/privacy-policy"
          target="_blank"
          rel="noreferrer"
        >
          TikTok Privacy Policy
        </a>
        .
      </p>

      <h3>4.3 YouTube &amp; Google</h3>
      <p>
        We use Google OAuth to connect your YouTube channel and, with your permission, upload Shorts/promo
        videos you prepare in the app, read your channel information (title, channel ID, thumbnail) to
        display the connection, and read statistics for videos uploaded through the Service. Typical scopes
        include{" "}
        <code className="text-xs text-foreground">youtube.upload</code>,{" "}
        <code className="text-xs text-foreground">youtube.readonly</code>,{" "}
        <code className="text-xs text-foreground">openid</code>, and{" "}
        <code className="text-xs text-foreground">profile</code>. Google Sign-In for app login may use{" "}
        <code className="text-xs text-foreground">email</code> and profile scopes to create or sign in to
        your MusicPromo AI account; that is separate from YouTube publishing unless you also connect YouTube.
        Our use of information received from Google APIs adheres to the{" "}
        <a
          className="underline hover:text-foreground"
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noreferrer"
        >
          Google API Services User Data Policy
        </a>
        , including Limited Use requirements. You can revoke access in your{" "}
        <a
          className="underline hover:text-foreground"
          href="https://myaccount.google.com/permissions"
          target="_blank"
          rel="noreferrer"
        >
          Google Account permissions
        </a>{" "}
        or disconnect in Social Hub. See{" "}
        <a
          className="underline hover:text-foreground"
          href="https://policies.google.com/privacy"
          target="_blank"
          rel="noreferrer"
        >
          Google Privacy Policy
        </a>
        .
      </p>

      <h3>4.4 X (formerly Twitter)</h3>
      <p>
        We use X OAuth 2.0 to connect your X account, display your profile in Social Hub, and publish posts
        (including text and media) when you compose or schedule content. Typical scopes include{" "}
        <code className="text-xs text-foreground">tweet.read</code>,{" "}
        <code className="text-xs text-foreground">tweet.write</code>,{" "}
        <code className="text-xs text-foreground">users.read</code>, and{" "}
        <code className="text-xs text-foreground">offline.access</code>. See{" "}
        <a
          className="underline hover:text-foreground"
          href="https://x.com/en/privacy"
          target="_blank"
          rel="noreferrer"
        >
          X Privacy Policy
        </a>{" "}
        and disconnect in Social Hub or X connected apps settings.
      </p>

      <h3>4.5 Facebook Pages (if enabled)</h3>
      <p>
        If we enable Facebook Page publishing in your region or account, we may request Page-related
        permissions (such as listing Pages you manage and publishing to a Page you select). We use Page data
        only to publish content you authorize. Meta’s policies apply.
      </p>

      <h2>5. AI processing</h2>
      <p>
        When you use AI features (captions, hooks, artwork, audio tools, or support chat), we send the
        prompts and media you provide to our AI infrastructure providers to generate results returned to you.
        Do not submit sensitive personal data you do not want processed for that purpose. You are responsible
        for reviewing AI output before publishing to social platforms.
      </p>

      <h2>6. Automated scheduling</h2>
      <p>
        If you use <strong className="text-foreground">Schedule auto-publish</strong> on a campaign day, we
        store the scheduled time and create platform post records in a <strong className="text-foreground">
        scheduled</strong> state until the publish worker runs at or after that time. You can cancel
        scheduling by removing posts from the Social queue, cancelling auto-publish when deleting a campaign,
        or disconnecting the platform. We do not publish to platforms you have not connected or for days you
        have not scheduled.
      </p>

      <h2>7. How we share information</h2>
      <p>We do not sell your personal information. We share data only with:</p>
      <ul>
        <li>
          <strong className="text-foreground">Infrastructure &amp; hosting</strong> — cloud hosting, database,
          storage, and serverless functions that run the app (e.g. Supabase and related providers).
        </li>
        <li>
          <strong className="text-foreground">Social platforms</strong> — when you authorize publishing,
          analytics, or account linking, we transmit content and metadata required by that platform’s API.
        </li>
        <li>
          <strong className="text-foreground">Payment processor</strong> — Stripe or similar, for billing you
          initiate.
        </li>
        <li>
          <strong className="text-foreground">AI &amp; email providers</strong> — to deliver features and
          messages you request.
        </li>
        <li>
          <strong className="text-foreground">Legal &amp; safety</strong> — when required by law, court order,
          or to protect rights, safety, and integrity of the Service.
        </li>
      </ul>

      <h2>8. Data retention</h2>
      <p>
        We retain account and campaign data while your account is active. Encrypted social tokens remain until
        you disconnect the platform or delete your account. Published post records may be retained for your
        history and analytics until you delete them or your account. Logs are retained for a limited period for
        security and operations. You may request deletion as described below.
      </p>

      <h2>9. Security</h2>
      <p>
        We use HTTPS for data in transit and encrypt social OAuth tokens at rest. Access to production systems
        is restricted. No method of transmission or storage is completely secure; please use a strong password
        and protect your device.
      </p>

      <h2 id="your-choices">10. Your choices &amp; rights</h2>
      <ul>
        <li>Disconnect Instagram, TikTok, YouTube, X, or other connected platforms in Social Hub.</li>
        <li>Revoke OAuth access in each platform’s own settings (links in section 4).</li>
        <li>Update profile and notification preferences in Settings.</li>
        <li>Edit or delete campaign content you created.</li>
        <li>
          Request access, correction, or deletion of personal data by contacting{" "}
          <SupportEmailLink />.
        </li>
        <li>
          Where applicable (EEA/UK/California and similar laws), you may have additional rights to access,
          port, delete, or restrict processing; contact us to exercise them.
        </li>
      </ul>

      <h2 id="data-deletion">11. Account &amp; data deletion</h2>
      <p>
        To delete your MusicPromo AI account and associated workspace data: sign in →{" "}
        <strong className="text-foreground">Settings → Account</strong> → delete account (confirm with
        DELETE). This removes your profile, campaigns, connections, and stored tokens from our systems, subject
        to backups and legal retention limits.
      </p>
      <p>
        To stop platform access without deleting your entire account: disconnect each social network in Social
        Hub. For Instagram/TikTok/Google/X data already held by those companies, use their privacy tools as
        well.
      </p>
      <p>
        For deletion requests you cannot complete in the app, email <SupportEmailLink /> from your account email
        with the subject “Data deletion request”. We may verify your identity before processing.
      </p>
      <p>
        Public policy URL for developer consoles:{" "}
        <a className="underline hover:text-foreground" href={`${PRIMARY_APP_ORIGIN}/privacy`}>
          {PRIMARY_APP_ORIGIN}/privacy
        </a>{" "}
        (section “Account &amp; data deletion”).
      </p>

      <h2>12. Children</h2>
      <p>
        The Service is not directed to children under 13 (or the minimum digital consent age in your
        country). We do not knowingly collect personal information from children. Each connected social
        platform imposes its own minimum age requirements; you must meet those requirements to connect and
        publish.
      </p>

      <h2>13. International transfers</h2>
      <p>
        We and our subprocessors may process data in the United States and other countries where we or our
        providers operate. We use appropriate safeguards where required for cross-border transfers.
      </p>

      <h2>14. Changes</h2>
      <p>
        We may update this Privacy Policy. The “Last updated” date below will change when we do. Material
        changes may be announced in the app. Continued use after the effective date means you accept the
        updated policy.
      </p>

      <h2>15. Contact</h2>
      <p>
        Privacy questions or requests: <SupportEmailLink /> or in-app Settings → Support. Operator: MusicPromo
        AI (contact via support email above).
      </p>
    </LegalPage>
  );
}
