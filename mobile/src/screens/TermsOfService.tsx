import LegalPage, { B, H2, Li, LegalLink, P, Ul } from '@/components/LegalPage';

export default function TermsOfService() {
  return (
    <LegalPage title="Terms of Service">
      <P>
        These Terms of Service (“Terms”) govern your use of MusicPromo AI (the “Service”) available at{" "}
        <B>https://flying-sonic-promo-flow.base44.app</B>. By
        creating an account or using the Service, you agree to these Terms.
      </P>

      <H2>1. The Service</H2>
      <P>
        MusicPromo AI helps artists and teams plan music promotion campaigns, generate marketing copy,
        prepare media, and publish short-form content to platforms you connect (such as Instagram,
        TikTok, and YouTube). Features may change as we improve the product.
      </P>

      <H2>2. Eligibility &amp; accounts</H2>
      <Ul>
        <Li>You must be old enough to form a binding contract in your jurisdiction and meet each platform’s age requirements.</Li>
        <Li>You are responsible for your login credentials and for activity under your account.</Li>
        <Li>Provide accurate registration information and keep it up to date.</Li>
      </Ul>

      <H2>3. Your content</H2>
      <P>
        You retain ownership of music, artwork, captions, and other materials you upload (“Your
        Content”). You grant us a limited license to host, process, and transmit Your Content solely to
        operate the Service (including publishing to platforms you authorize). You represent that you
        have all rights needed to use and publish Your Content and that it does not infringe others’
        rights or violate law or platform policies.
      </P>

      <H2>4. Social platforms</H2>
      <Ul>
        <Li>Connecting Instagram, TikTok, or YouTube is optional and controlled by you via OAuth.</Li>
        <Li>Publishing and analytics use only the permissions you grant; you can revoke access in the platform or in Social Hub.</Li>
        <Li>Each platform’s terms and developer policies also apply. We are not responsible for changes, outages, or enforcement by Meta, TikTok, or Google/YouTube.</Li>
      </Ul>

      <H2>5. Acceptable use</H2>
      <P>You agree not to:</P>
      <Ul>
        <Li>Use the Service for spam, harassment, illegal content, or deceptive promotion.</Li>
        <Li>Attempt to bypass security, scrape the Service abusively, or reverse engineer except where allowed by law.</Li>
        <Li>Upload malware or content that violates intellectual property, privacy, or publicity rights.</Li>
        <Li>Misrepresent affiliation with artists, labels, or brands you do not represent.</Li>
      </Ul>

      <H2>6. AI-generated suggestions</H2>
      <P>
        Campaign ideas, captions, and related AI outputs are suggestions only. You are responsible for
        reviewing and editing them before publishing. We do not guarantee accuracy, originality, or
        fitness for a particular purpose.
      </P>

      <H2>7. Availability</H2>
      <P>
        We aim for reliable uptime but do not guarantee uninterrupted Service. Features that depend on
        third-party APIs may be limited by those providers’ rate limits, reviews, or outages.
      </P>

      <H2>8. Disclaimers</H2>
      <P>
        THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR
        IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO
        THE MAXIMUM EXTENT PERMITTED BY LAW.
      </P>

      <H2>9. Limitation of liability</H2>
      <P>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL,
        CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR
        USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO THE
        AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM (OR ZERO IF THE
        SERVICE WAS FREE).
      </P>

      <H2>10. Termination</H2>
      <P>
        You may stop using the Service at any time. We may suspend or terminate access if you violate
        these Terms or create risk for the Service or other users. Sections that by nature should
        survive (including ownership, disclaimers, and liability limits) will survive termination.
      </P>

      <H2>11. Changes</H2>
      <P>
        We may update these Terms. We will update the “Last updated” date on this page. Continued use
        after changes constitutes acceptance of the revised Terms.
      </P>

      <H2>12. Contact</H2>
      <P>
        Questions about these Terms:{" "}
        <LegalLink href="mailto:support@flying-sonic-promo-flow.base44.app">
          support@flying-sonic-promo-flow.base44.app
        </LegalLink>
        .
      </P>

      <H2>13. Related policies</H2>
      <P>
        See our{" "}
        <LegalLink href="/privacy">
          Privacy Policy
        </LegalLink>{" "}
        for how we handle personal data.
      </P>
    </LegalPage>
  );
}
