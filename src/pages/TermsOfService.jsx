import LegalPage from "@/components/LegalPage";

/**
 * Public Terms of Service — required for TikTok / Google / Meta app review.
 * URL: https://flying-sonic-promo-flow.base44.app/terms
 */
export default function TermsOfService() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These Terms of Service (“Terms”) govern your use of MusicPromo AI (the “Service”) available at{" "}
        <strong className="text-foreground">https://flying-sonic-promo-flow.base44.app</strong>. By
        creating an account or using the Service, you agree to these Terms.
      </p>

      <h2>1. The Service</h2>
      <p>
        MusicPromo AI helps artists and teams plan music promotion campaigns, generate marketing copy,
        prepare media, and publish short-form content to platforms you connect (such as Instagram,
        TikTok, and YouTube). Features may change as we improve the product.
      </p>

      <h2>2. Eligibility &amp; accounts</h2>
      <ul>
        <li>You must be old enough to form a binding contract in your jurisdiction and meet each platform’s age requirements.</li>
        <li>You are responsible for your login credentials and for activity under your account.</li>
        <li>Provide accurate registration information and keep it up to date.</li>
      </ul>

      <h2>3. Your content</h2>
      <p>
        You retain ownership of music, artwork, captions, and other materials you upload (“Your
        Content”). You grant us a limited license to host, process, and transmit Your Content solely to
        operate the Service (including publishing to platforms you authorize). You represent that you
        have all rights needed to use and publish Your Content and that it does not infringe others’
        rights or violate law or platform policies.
      </p>

      <h2>4. Social platforms</h2>
      <ul>
        <li>Connecting Instagram, TikTok, or YouTube is optional and controlled by you via OAuth.</li>
        <li>Publishing and analytics use only the permissions you grant; you can revoke access in the platform or in Social Hub.</li>
        <li>Each platform’s terms and developer policies also apply. We are not responsible for changes, outages, or enforcement by Meta, TikTok, or Google/YouTube.</li>
      </ul>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for spam, harassment, illegal content, or deceptive promotion.</li>
        <li>Attempt to bypass security, scrape the Service abusively, or reverse engineer except where allowed by law.</li>
        <li>Upload malware or content that violates intellectual property, privacy, or publicity rights.</li>
        <li>Misrepresent affiliation with artists, labels, or brands you do not represent.</li>
      </ul>

      <h2>6. AI-generated suggestions</h2>
      <p>
        Campaign ideas, captions, and related AI outputs are suggestions only. You are responsible for
        reviewing and editing them before publishing. We do not guarantee accuracy, originality, or
        fitness for a particular purpose.
      </p>

      <h2>7. Availability</h2>
      <p>
        We aim for reliable uptime but do not guarantee uninterrupted Service. Features that depend on
        third-party APIs may be limited by those providers’ rate limits, reviews, or outages.
      </p>

      <h2>8. Disclaimers</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO
        THE MAXIMUM EXTENT PERMITTED BY LAW.
      </p>

      <h2>9. Limitation of liability</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR
        USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO THE
        AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM (OR ZERO IF THE
        SERVICE WAS FREE).
      </p>

      <h2>10. Termination</h2>
      <p>
        You may stop using the Service at any time. We may suspend or terminate access if you violate
        these Terms or create risk for the Service or other users. Sections that by nature should
        survive (including ownership, disclaimers, and liability limits) will survive termination.
      </p>

      <h2>11. Changes</h2>
      <p>
        We may update these Terms. We will update the “Last updated” date on this page. Continued use
        after changes constitutes acceptance of the revised Terms.
      </p>

      <h2>12. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a className="underline hover:text-foreground" href="mailto:support@flying-sonic-promo-flow.base44.app">
          support@flying-sonic-promo-flow.base44.app
        </a>
        .
      </p>

      <h2>13. Related policies</h2>
      <p>
        See our{" "}
        <a className="underline hover:text-foreground" href="/privacy">
          Privacy Policy
        </a>{" "}
        for how we handle personal data.
      </p>
    </LegalPage>
  );
}
