import LegalDocumentScreen, { type LegalBlock } from '@/screens/LegalDocumentScreen';

const blocks: LegalBlock[] = [
  {
    type: 'p',
    text: 'MusicPromo AI (“we”, “us”, “our”) helps musicians plan campaigns and publish promotional content to social platforms. This Privacy Policy explains what information we collect, how we use it, and your choices. By using the app at flying-sonic-promo-flow.base44.app, you agree to this policy.',
  },
  { type: 'h2', text: '1. Information we collect' },
  {
    type: 'ul',
    items: [
      'Account data — email, name, and authentication details when you register or sign in.',
      'Campaign & creative data — songs, releases, captions, artwork, and video projects you upload or generate in the app.',
      'Social connection data — when you connect Instagram, TikTok, or YouTube, we store account identifiers, usernames, granted scopes, and encrypted access/refresh tokens needed to publish and read stats on your behalf.',
      'Usage & analytics — publish history and performance metrics (views, likes, comments, shares) synced from platforms you connect, plus basic technical logs for reliability and security.',
    ],
  },
  { type: 'h2', text: '2. How we use information' },
  {
    type: 'ul',
    items: [
      'Provide campaign planning, content generation, and social publishing features.',
      'Authenticate you and secure your account.',
      'Post content and fetch engagement metrics only after you connect a platform and grant permission.',
      'Improve reliability, debug errors, and prevent abuse.',
      'Comply with law and platform developer policies (Meta, TikTok, Google/YouTube).',
    ],
  },
  { type: 'h2', text: '3. Social platform access' },
  {
    type: 'p',
    text: 'We only request the OAuth scopes needed for the features you use (for example Instagram content publish, TikTok video upload/publish, YouTube upload and read). Tokens are encrypted at rest and are never exposed to the browser. You can disconnect a platform at any time in Social Hub; we then stop using that token for new actions.',
  },
  { type: 'h2', text: '4. Sharing' },
  {
    type: 'p',
    text: 'We do not sell your personal information. We share data only with: (a) infrastructure providers that host the app (including Base44); (b) social platforms when you authorize publishing or analytics; and (c) when required by law or to protect our rights and users.',
  },
  { type: 'h2', text: '5. Data retention' },
  {
    type: 'p',
    text: 'We retain account and campaign data while your account is active. Encrypted social tokens are kept until you disconnect or delete the connection. You may request deletion of your account data by contacting us; we will delete or anonymize personal data except where we must retain it for legal or security reasons.',
  },
  { type: 'h2', text: '6. Security' },
  {
    type: 'p',
    text: 'We use HTTPS in transit and encrypt social credentials at rest. No method of transmission or storage is 100% secure; please use a strong password and protect your login.',
  },
  { type: 'h2', text: '7. Children' },
  {
    type: 'p',
    text: 'MusicPromo AI is not directed to children under 13 (or the minimum age required in your jurisdiction). We do not knowingly collect personal information from children.',
  },
  { type: 'h2', text: '8. Your choices' },
  {
    type: 'ul',
    items: [
      'Disconnect Instagram, TikTok, or YouTube from Social Hub.',
      'Update or delete campaign content you created.',
      'Contact us to request access, correction, or deletion of personal data.',
    ],
  },
  { type: 'h2', text: '9. International transfers' },
  {
    type: 'p',
    text: 'Your data may be processed in countries where our hosting providers operate. We take steps appropriate to the services we use to protect that data.',
  },
  { type: 'h2', text: '10. Changes' },
  {
    type: 'p',
    text: 'We may update this policy from time to time. The “Last updated” date at the bottom of this page will change when we do. Continued use of the app after changes means you accept the updated policy.',
  },
  { type: 'h2', text: '11. Contact' },
  {
    type: 'p',
    text: 'Questions about privacy: open Settings in the app or email support@flying-sonic-promo-flow.base44.app.',
  },
];

export default function PrivacyPolicyScreen() {
  return <LegalDocumentScreen title="Privacy Policy" blocks={blocks} />;
}
