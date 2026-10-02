import LegalDocumentScreen, { type LegalBlock } from '@/screens/LegalDocumentScreen';

const blocks: LegalBlock[] = [
  {
    type: 'p',
    text: 'These Terms of Service (“Terms”) govern your use of MusicPromo AI (the “Service”) available at https://flying-sonic-promo-flow.base44.app. By creating an account or using the Service, you agree to these Terms.',
  },
  { type: 'h2', text: '1. The Service' },
  {
    type: 'p',
    text: 'MusicPromo AI helps artists and teams plan music promotion campaigns, generate marketing copy, prepare media, and publish short-form content to platforms you connect (such as Instagram, TikTok, and YouTube). Features may change as we improve the product.',
  },
  { type: 'h2', text: '2. Eligibility & accounts' },
  {
    type: 'ul',
    items: [
      'You must be old enough to form a binding contract in your jurisdiction and meet each platform’s age requirements.',
      'You are responsible for your login credentials and for activity under your account.',
      'Provide accurate registration information and keep it up to date.',
    ],
  },
  { type: 'h2', text: '3. Your content' },
  {
    type: 'p',
    text: 'You retain ownership of music, artwork, captions, and other materials you upload (“Your Content”). You grant us a limited license to host, process, and transmit Your Content solely to operate the Service (including publishing to platforms you authorize). You represent that you have all rights needed to use and publish Your Content and that it does not infringe others’ rights or violate law or platform policies.',
  },
  { type: 'h2', text: '4. Social platforms' },
  {
    type: 'ul',
    items: [
      'Connecting Instagram, TikTok, or YouTube is optional and controlled by you via OAuth.',
      'Publishing and analytics use only the permissions you grant; you can revoke access in the platform or in Social Hub.',
      'Each platform’s terms and developer policies also apply. We are not responsible for changes, outages, or enforcement by Meta, TikTok, or Google/YouTube.',
    ],
  },
  { type: 'h2', text: '5. Acceptable use' },
  {
    type: 'p',
    text: 'You agree not to: use the Service for spam, harassment, illegal content, or deceptive promotion; attempt to bypass security or scrape abusively; upload malware or infringing content; or misrepresent affiliation with artists, labels, or brands you do not represent.',
  },
  { type: 'h2', text: '6. AI-generated suggestions' },
  {
    type: 'p',
    text: 'Campaign ideas, captions, and related AI outputs are suggestions only. You are responsible for reviewing and editing them before publishing. We do not guarantee accuracy, originality, or fitness for a particular purpose.',
  },
  { type: 'h2', text: '7. Availability' },
  {
    type: 'p',
    text: 'We aim for reliable uptime but do not guarantee uninterrupted Service. Features that depend on third-party APIs may be limited by those providers’ rate limits, reviews, or outages.',
  },
  { type: 'h2', text: '8. Disclaimers' },
  {
    type: 'p',
    text: 'THE SERVICE IS PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT, TO THE MAXIMUM EXTENT PERMITTED BY LAW.',
  },
  { type: 'h2', text: '9. Limitation of liability' },
  {
    type: 'p',
    text: 'TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, OR GOODWILL, ARISING FROM YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE IS LIMITED TO THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM (OR ZERO IF THE SERVICE WAS FREE).',
  },
  { type: 'h2', text: '10. Termination' },
  {
    type: 'p',
    text: 'You may stop using the Service at any time. We may suspend or terminate access if you violate these Terms or create risk for the Service or other users. Sections that by nature should survive will survive termination.',
  },
  { type: 'h2', text: '11. Changes' },
  {
    type: 'p',
    text: 'We may update these Terms. We will update the “Last updated” date on this page. Continued use after changes constitutes acceptance of the revised Terms.',
  },
  { type: 'h2', text: '12. Contact' },
  {
    type: 'p',
    text: 'Questions about these Terms: support@flying-sonic-promo-flow.base44.app.',
  },
  { type: 'h2', text: '13. Related policies' },
  {
    type: 'p',
    text: 'See our Privacy Policy for how we handle personal data.',
  },
];

export default function TermsOfServiceScreen() {
  return <LegalDocumentScreen title="Terms of Service" blocks={blocks} />;
}
