import LegalPage from "@/components/LegalPage";
import SupportEmailLink from "@/components/SupportEmailLink";
import { PRIMARY_APP_ORIGIN, PUBLIC_APP_ORIGINS, PRIVACY_URL } from "@/content/publicAppUrls";

/**
 * Public Terms of Service — OAuth app review (Meta/Instagram, TikTok, Google/YouTube, X).
 */
export default function TermsOfService() {
  const originsList = PUBLIC_APP_ORIGINS.join(", ");

  return (
    <LegalPage title="Terms of Service">
      <p>
        These Terms of Service (“<strong className="text-foreground">Terms</strong>”) govern your access to
        and use of MusicPromo AI (the “<strong className="text-foreground">Service</strong>”) at{" "}
        <strong className="text-foreground">{originsList}</strong> and related domains we operate. By creating
        an account or using the Service, you agree to these Terms and our{" "}
        <a className="underline hover:text-foreground" href="/privacy">
          Privacy Policy
        </a>
        .
      </p>

      <h2>1. The Service</h2>
      <p>
        MusicPromo AI provides tools for artists and teams to plan music promotion campaigns, generate
        marketing copy and media with AI assistance, prepare short-form video, connect social accounts, and
        publish or schedule posts to platforms you authorize (including Instagram, TikTok, YouTube, and X).
        Optional features may include release launch boards, analytics, community profiles, subscriptions or
        credits, mobile apps, and email or push notifications. We may modify, suspend, or discontinue features
        with reasonable notice where practicable.
      </p>

      <h2>2. Eligibility &amp; accounts</h2>
      <ul>
        <li>
          You must be old enough to enter a binding contract where you live and meet each social platform’s
          minimum age and eligibility rules (including business/creator account requirements where applicable).
        </li>
        <li>You are responsible for safeguarding your login credentials and all activity under your account.</li>
        <li>You must provide accurate registration information and keep it current.</li>
        <li>
          You may sign in with email/password or Google Sign-In; Google’s terms and privacy policy apply to
          that authentication flow.
        </li>
      </ul>

      <h2>3. Your content</h2>
      <p>
        You retain ownership of music, artwork, video, captions, and other materials you upload or create
        (“<strong className="text-foreground">Your Content</strong>”). You grant us a worldwide, non-exclusive
        license to host, process, reproduce, and transmit Your Content solely to operate the Service—including
        formatting and delivering it to social APIs when you publish or schedule posts. You represent that you
        have all rights necessary to use and publish Your Content and that it does not violate law, third-party
        rights, or platform policies (copyright, trademark, publicity, privacy, and community guidelines).
      </p>

      <h2 id="social-platforms">4. Third-party social platforms</h2>
      <ul>
        <li>
          Connecting Instagram (Meta), TikTok, YouTube/Google, X, or other networks is optional and requires
          your explicit OAuth consent in the platform’s authorization flow.
        </li>
        <li>
          Publishing, scheduling, and analytics use only the permissions you grant. You can revoke access in
          the platform’s settings or by disconnecting in MusicPromo AI Social Hub.
        </li>
        <li>
          Each platform’s terms, developer policies, and community guidelines apply to your use of that
          platform through the Service. We are not responsible for platform outages, API changes, account
          enforcement, or content moderation decisions by Meta, TikTok, Google/YouTube, X, or others.
        </li>
        <li>
          You are solely responsible for the content published from your connected accounts, including
          sponsored or promotional disclosures required by law or platform rules.
        </li>
        <li>
          <strong className="text-foreground">Auto-publish:</strong> when you schedule a campaign day, you
          instruct us to attempt publication at the scheduled time to connected accounts. You must ensure
          media, captions, and account connections are valid before the scheduled time.
        </li>
      </ul>

      <h3>4.1 Platform-specific notices</h3>
      <p>
        By connecting a platform, you also agree to that provider’s applicable terms, including: Meta/Instagram
        Terms and Policies; TikTok Terms of Service and Developer Terms; Google Terms of Service and YouTube
        Terms of Service; and X Terms of Service and Developer Agreement. Links to those policies are available
        on each provider’s website and may change over time.
      </p>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for spam, fraud, harassment, hate speech, illegal activity, or deceptive promotion.</li>
        <li>Violate intellectual property, privacy, or publicity rights.</li>
        <li>Circumvent security, abuse APIs, or scrape the Service except as allowed by law or our robots rules.</li>
        <li>Upload malware or attempt unauthorized access to other users’ data.</li>
        <li>Misrepresent affiliation with artists, labels, or brands you do not represent.</li>
        <li>Use the Service in any way that violates applicable platform developer or content policies.</li>
      </ul>

      <h2>6. AI-generated output</h2>
      <p>
        Suggestions from AI features (captions, hooks, images, audio, support chat) are provided “as is.” You
        must review and edit outputs before publishing. We do not guarantee accuracy, originality, non-infringement,
        or fitness for a particular purpose.
      </p>

      <h2>7. Subscriptions, credits &amp; billing</h2>
      <p>
        Paid plans or credit packs, if offered, are billed through our payment processor (e.g. Stripe) subject to
        displayed pricing and renewal terms. Fees are non-refundable except where required by law or stated at
        purchase. You may cancel subscriptions according to in-app billing controls or by contacting support.
      </p>

      <h2>8. Community features</h2>
      <p>
        If you use public profiles, follows, or community tools, you agree not to post abusive or illegal content
        and to respect other users’ rights. We may remove content or suspend accounts that violate these Terms.
      </p>

      <h2>9. Availability</h2>
      <p>
        We strive for reliable uptime but do not guarantee uninterrupted Service. Features depending on third-party
        APIs (social networks, AI, payment, email) may be limited by those providers’ rate limits, app review
        status, or outages.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR
        IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE MAXIMUM
        EXTENT PERMITTED BY LAW.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR SUPPLIERS ARE NOT LIABLE FOR INDIRECT, INCIDENTAL,
        SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, GOODWILL, OR PLATFORM STRIKES/RESTRICTIONS,
        ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO
        THE AMOUNTS YOU PAID US IN THE TWELVE (12) MONTHS BEFORE THE CLAIM (OR USD $100 IF THE SERVICE WAS FREE),
        WHICHEVER IS GREATER, EXCEPT WHERE LIABILITY CANNOT BE LIMITED BY LAW.
      </p>

      <h2>12. Indemnity</h2>
      <p>
        You will indemnify and hold us harmless from claims arising out of Your Content, your use of connected
        social accounts, or your violation of these Terms or platform policies, to the extent permitted by law.
      </p>

      <h2>13. Termination</h2>
      <p>
        You may stop using the Service at any time and may delete your account in Settings. We may suspend or
        terminate access if you breach these Terms or create risk for the Service or others. On termination,
        your license to use the Service ends; provisions that by nature should survive (including ownership,
        disclaimers, liability limits, and indemnity) survive.
      </p>

      <h2>14. Changes</h2>
      <p>
        We may update these Terms. We will update the “Last updated” date on this page. Continued use after the
        effective date constitutes acceptance of the revised Terms.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions about these Terms: <SupportEmailLink />.
      </p>

      <h2>16. Related policies</h2>
      <p>
        See our{" "}
        <a className="underline hover:text-foreground" href="/privacy">
          Privacy Policy
        </a>{" "}
        ({PRIVACY_URL}) for how we collect and use personal data, including social platform integrations and
        data deletion instructions.
      </p>
      <p className="text-xs">
        Public Terms URL for developer registration:{" "}
        <a className="underline hover:text-foreground" href={`${PRIMARY_APP_ORIGIN}/terms`}>
          {PRIMARY_APP_ORIGIN}/terms
        </a>
      </p>
    </LegalPage>
  );
}
