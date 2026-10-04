# Supabase auth email templates (MusicPromo AI)

Paste each HTML block into **Supabase Dashboard → Authentication → Email templates**.

**Brand colors** (from app `src/index.css`):

| Token | Hex |
|--------|-----|
| Background | `#f6f7f9` |
| Card | `#ffffff` |
| Text | `#0f121a` |
| Muted text | `#616875` |
| Border | `#dcdfe5` / `#edeff2` |
| Primary | `#9049f3` |
| Accent | `#ec3ca0` |

**OTP / link expiry:** Set copy to match **Authentication → Providers → Email → Email OTP expiration** (e.g. **5 minutes** = 300 seconds). Sign-up metadata can expose `{{ .Data.otp_expires_minutes }}` for new users.

**Logo URL:** `https://hmqxptxtcejhmuwbegvq.supabase.co/storage/v1/object/public/public-assets/musicpromo-ai-icon-1024.png`

**Support email:** `support@musicpromoai.site` — use a `mailto:` link for “contact support” copy:

`<a href="mailto:support@musicpromoai.site" style="color: #9049f3; font-weight: 600; text-decoration: underline;">contact support</a>`

---

## Suggested subjects

| Template | Subject |
|----------|---------|
| Confirm signup | `Your MusicPromo AI verification code` |
| Magic Link | `Your sign-in link for MusicPromo AI` |
| Reset password | `Reset your MusicPromo AI password` |
| Invite user | `You're invited to MusicPromo AI` |
| Change email | `Confirm your new email — MusicPromo AI` |
| Reauthentication | `Your MusicPromo AI verification code` |

---

## Magic Link

Uses `{{ .ConfirmationURL }}`. Single-use; same expiry as email OTP setting.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7f9; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f7f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border: 1px solid #dcdfe5; border-radius: 16px; box-shadow: 0 2px 4px rgba(15, 18, 26, 0.04), 0 16px 40px -12px rgba(15, 18, 26, 0.12); overflow: hidden; text-align: left;">
          <tr><td style="height: 4px; background: linear-gradient(120deg, #9049f3, #ec3ca0); font-size: 0; line-height: 0;">&nbsp;</td></tr>
          <tr>
            <td style="padding: 28px 32px 24px 32px; border-bottom: 1px solid #edeff2;">
              <table border="0" cellspacing="0" cellpadding="0"><tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="https://hmqxptxtcejhmuwbegvq.supabase.co/storage/v1/object/public/public-assets/musicpromo-ai-icon-1024.png" alt="MusicPromo AI" width="36" height="36" style="display: block; border: 0; width: 36px; height: 36px; border-radius: 10px;" />
                </td>
                <td style="vertical-align: middle;"><span style="font-size: 20px; font-weight: 700; color: #0f121a;">MusicPromo AI</span></td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 8px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: #0f121a;">
                {{ if .Data.username }}Hi <span style="color: #9049f3;">@{{ .Data.username }}</span>,{{ else }}Sign in to MusicPromo AI{{ end }}
              </h2>
              <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 24px; color: #616875;">
                Tap the button below to sign in. This link works once and expires shortly.
              </p>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #616875;">
                {{ if .Data.otp_expires_minutes }}<strong style="color: #0f121a;">Expires in {{ .Data.otp_expires_minutes }} minutes.</strong>{{ else }}<strong style="color: #0f121a;">Expires in 5 minutes.</strong>{{ end }}
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 8px 32px 28px 32px;">
              <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(120deg, #9049f3, #ec3ca0); color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 999px; text-decoration: none;">Sign in</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 28px 32px; border-top: 1px solid #edeff2;">
              <p style="margin: 20px 0 8px 0; font-size: 12px; line-height: 18px; color: #616875;">If the button doesn&apos;t work, copy this link:</p>
              <p style="margin: 0; font-size: 11px; line-height: 16px; color: #9049f3; word-break: break-all;">{{ .ConfirmationURL }}</p>
              <p style="margin: 16px 0 0 0; font-size: 13px; line-height: 20px; color: #616875;">If you didn&apos;t request this email, you can ignore it.</p>
            </td>
          </tr>
        </table>
        <table width="100%" style="max-width: 480px; text-align: center; margin-top: 20px;"><tr><td><p style="margin: 0; font-size: 12px; color: #616875;">&copy; 2026 MusicPromo AI</p></td></tr></table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Reset password (Recovery)

Uses `{{ .ConfirmationURL }}`.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7f9; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f7f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border: 1px solid #dcdfe5; border-radius: 16px; box-shadow: 0 2px 4px rgba(15, 18, 26, 0.04), 0 16px 40px -12px rgba(15, 18, 26, 0.12); overflow: hidden; text-align: left;">
          <tr><td style="height: 4px; background: linear-gradient(120deg, #9049f3, #ec3ca0); font-size: 0; line-height: 0;">&nbsp;</td></tr>
          <tr>
            <td style="padding: 28px 32px 24px 32px; border-bottom: 1px solid #edeff2;">
              <table border="0" cellspacing="0" cellpadding="0"><tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="https://hmqxptxtcejhmuwbegvq.supabase.co/storage/v1/object/public/public-assets/musicpromo-ai-icon-1024.png" alt="MusicPromo AI" width="36" height="36" style="display: block; border: 0; width: 36px; height: 36px; border-radius: 10px;" />
                </td>
                <td style="vertical-align: middle;"><span style="font-size: 20px; font-weight: 700; color: #0f121a;">MusicPromo AI</span></td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 8px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: #0f121a;">Reset your password</h2>
              <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 24px; color: #616875;">
                We received a request to reset the password for <strong style="color: #0f121a;">{{ .Email }}</strong>.
              </p>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #616875;">
                {{ if .Data.otp_expires_minutes }}<strong style="color: #0f121a;">This link expires in {{ .Data.otp_expires_minutes }} minutes.</strong>{{ else }}<strong style="color: #0f121a;">This link expires in 5 minutes.</strong>{{ end }}
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 8px 32px 28px 32px;">
              <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(120deg, #9049f3, #ec3ca0); color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 999px; text-decoration: none;">Reset password</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 28px 32px; border-top: 1px solid #edeff2;">
              <p style="margin: 20px 0 8px 0; font-size: 12px; line-height: 18px; color: #616875;">Or copy this link:</p>
              <p style="margin: 0; font-size: 11px; line-height: 16px; color: #9049f3; word-break: break-all;">{{ .ConfirmationURL }}</p>
              <p style="margin: 16px 0 0 0; font-size: 13px; line-height: 20px; color: #616875;">If you didn&apos;t request a reset, ignore this email — your password won&apos;t change.</p>
            </td>
          </tr>
        </table>
        <table width="100%" style="max-width: 480px; text-align: center; margin-top: 20px;"><tr><td><p style="margin: 0; font-size: 12px; color: #616875;">&copy; 2026 MusicPromo AI</p></td></tr></table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Invite user

Uses `{{ .ConfirmationURL }}`, optional `{{ .SiteURL }}`.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7f9; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f7f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border: 1px solid #dcdfe5; border-radius: 16px; box-shadow: 0 2px 4px rgba(15, 18, 26, 0.04), 0 16px 40px -12px rgba(15, 18, 26, 0.12); overflow: hidden; text-align: left;">
          <tr><td style="height: 4px; background: linear-gradient(120deg, #9049f3, #ec3ca0); font-size: 0; line-height: 0;">&nbsp;</td></tr>
          <tr>
            <td style="padding: 28px 32px 24px 32px; border-bottom: 1px solid #edeff2;">
              <table border="0" cellspacing="0" cellpadding="0"><tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="https://hmqxptxtcejhmuwbegvq.supabase.co/storage/v1/object/public/public-assets/musicpromo-ai-icon-1024.png" alt="MusicPromo AI" width="36" height="36" style="display: block; border: 0; width: 36px; height: 36px; border-radius: 10px;" />
                </td>
                <td style="vertical-align: middle;"><span style="font-size: 20px; font-weight: 700; color: #0f121a;">MusicPromo AI</span></td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 8px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: #0f121a;">You&apos;re invited</h2>
              <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 24px; color: #616875;">
                You&apos;ve been invited to join MusicPromo AI. Accept the invitation to create your account and start planning releases.
              </p>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #616875;">
                {{ if .Data.otp_expires_minutes }}<strong style="color: #0f121a;">This invitation link expires in {{ .Data.otp_expires_minutes }} minutes.</strong>{{ else }}<strong style="color: #0f121a;">This invitation link expires in 5 minutes.</strong>{{ end }}
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 8px 32px 28px 32px;">
              <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(120deg, #9049f3, #ec3ca0); color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 999px; text-decoration: none;">Accept invitation</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 28px 32px; border-top: 1px solid #edeff2;">
              <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 20px; color: #616875;">If you weren&apos;t expecting this invite, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
        <table width="100%" style="max-width: 480px; text-align: center; margin-top: 20px;"><tr><td><p style="margin: 0; font-size: 12px; color: #616875;">&copy; 2026 MusicPromo AI</p></td></tr></table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Change email address

Uses `{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm email change</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7f9; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f7f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border: 1px solid #dcdfe5; border-radius: 16px; box-shadow: 0 2px 4px rgba(15, 18, 26, 0.04), 0 16px 40px -12px rgba(15, 18, 26, 0.12); overflow: hidden; text-align: left;">
          <tr><td style="height: 4px; background: linear-gradient(120deg, #9049f3, #ec3ca0); font-size: 0; line-height: 0;">&nbsp;</td></tr>
          <tr>
            <td style="padding: 28px 32px 24px 32px; border-bottom: 1px solid #edeff2;">
              <table border="0" cellspacing="0" cellpadding="0"><tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="https://hmqxptxtcejhmuwbegvq.supabase.co/storage/v1/object/public/public-assets/musicpromo-ai-icon-1024.png" alt="MusicPromo AI" width="36" height="36" style="display: block; border: 0; width: 36px; height: 36px; border-radius: 10px;" />
                </td>
                <td style="vertical-align: middle;"><span style="font-size: 20px; font-weight: 700; color: #0f121a;">MusicPromo AI</span></td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 8px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: #0f121a;">Confirm your new email</h2>
              <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 24px; color: #616875;">
                Confirm changing your account email from <strong style="color: #0f121a;">{{ .Email }}</strong> to <strong style="color: #9049f3;">{{ .NewEmail }}</strong>.
              </p>
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #616875;">
                {{ if .Data.otp_expires_minutes }}<strong style="color: #0f121a;">This link expires in {{ .Data.otp_expires_minutes }} minutes.</strong>{{ else }}<strong style="color: #0f121a;">This link expires in 5 minutes.</strong>{{ end }}
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 8px 32px 28px 32px;">
              <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(120deg, #9049f3, #ec3ca0); color: #ffffff; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 999px; text-decoration: none;">Confirm new email</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 28px 32px; border-top: 1px solid #edeff2;">
              <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 20px; color: #616875;">If you didn&apos;t request this change, ignore this email.</p>
            </td>
          </tr>
        </table>
        <table width="100%" style="max-width: 480px; text-align: center; margin-top: 20px;"><tr><td><p style="margin: 0; font-size: 12px; color: #616875;">&copy; 2026 MusicPromo AI</p></td></tr></table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Reauthentication (sensitive action OTP)

Uses `{{ .Token }}` (6-digit code).

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7f9; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f7f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border: 1px solid #dcdfe5; border-radius: 16px; box-shadow: 0 2px 4px rgba(15, 18, 26, 0.04), 0 16px 40px -12px rgba(15, 18, 26, 0.12); overflow: hidden; text-align: left;">
          <tr><td style="height: 4px; background: linear-gradient(120deg, #9049f3, #ec3ca0); font-size: 0; line-height: 0;">&nbsp;</td></tr>
          <tr>
            <td style="padding: 28px 32px 24px 32px; border-bottom: 1px solid #edeff2;">
              <table border="0" cellspacing="0" cellpadding="0"><tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="https://hmqxptxtcejhmuwbegvq.supabase.co/storage/v1/object/public/public-assets/musicpromo-ai-icon-1024.png" alt="MusicPromo AI" width="36" height="36" style="display: block; border: 0; width: 36px; height: 36px; border-radius: 10px;" />
                </td>
                <td style="vertical-align: middle;"><span style="font-size: 20px; font-weight: 700; color: #0f121a;">MusicPromo AI</span></td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 8px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: #0f121a;">Verify it&apos;s you</h2>
              <p style="margin: 0 0 8px 0; font-size: 15px; line-height: 24px; color: #616875;">
                Enter this code to continue with a sensitive action on your account.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 16px 32px 12px 32px;">
              <div style="background-color: #f3edfe; border: 1px solid rgba(144, 73, 243, 0.25); border-radius: 12px; padding: 18px 28px; display: inline-block;">
                <span style="font-family: ui-monospace, 'SF Mono', 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; color: #9049f3; letter-spacing: 6px;">{{ .Token }}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 0 32px 24px 32px;">
              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #616875;">
                {{ if .Data.otp_expires_minutes }}<strong style="color: #0f121a;">Expires in {{ .Data.otp_expires_minutes }} minutes.</strong>{{ else }}<strong style="color: #0f121a;">Expires in 5 minutes.</strong>{{ end }}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 28px 32px; border-top: 1px solid #edeff2;">
              <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 20px; color: #616875;">If you didn&apos;t request this code, secure your account and <a href="mailto:support@musicpromoai.site" style="color: #9049f3; font-weight: 600; text-decoration: underline;">contact support</a>.</p>
            </td>
          </tr>
        </table>
        <table width="100%" style="max-width: 480px; text-align: center; margin-top: 20px;"><tr><td><p style="margin: 0; font-size: 12px; color: #616875;">&copy; 2026 MusicPromo AI</p></td></tr></table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Confirm signup

Uses `{{ .Token }}`, `{{ .Data.username }}`, `{{ .Data.pending_handle }}`, `{{ .Data.otp_expires_minutes }}`.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7f9; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f7f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border: 1px solid #dcdfe5; border-radius: 16px; box-shadow: 0 2px 4px rgba(15, 18, 26, 0.04), 0 16px 40px -12px rgba(15, 18, 26, 0.12); overflow: hidden; text-align: left;">
          <tr><td style="height: 4px; background: linear-gradient(120deg, #9049f3, #ec3ca0); font-size: 0; line-height: 0;">&nbsp;</td></tr>
          <tr>
            <td style="padding: 28px 32px 24px 32px; border-bottom: 1px solid #edeff2;">
              <table border="0" cellspacing="0" cellpadding="0"><tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="https://hmqxptxtcejhmuwbegvq.supabase.co/storage/v1/object/public/public-assets/musicpromo-ai-icon-1024.png" alt="MusicPromo AI" width="36" height="36" style="display: block; border: 0; width: 36px; height: 36px; border-radius: 10px;" />
                </td>
                <td style="vertical-align: middle;"><span style="font-size: 20px; font-weight: 700; color: #0f121a;">MusicPromo AI</span></td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 8px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: #0f121a;">
                {{ if .Data.username }}Hello <span style="color: #9049f3;">@{{ .Data.username }}</span>,{{ else if .Data.pending_handle }}Hello <span style="color: #9049f3;">@{{ .Data.pending_handle }}</span>,{{ else }}Hello,{{ end }}
              </h2>
              <p style="margin: 0 0 8px 0; font-size: 15px; line-height: 24px; color: #616875;">Enter this verification code in the app to finish creating your account.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 16px 32px 12px 32px;">
              <div style="background-color: #f3edfe; border: 1px solid rgba(144, 73, 243, 0.25); border-radius: 12px; padding: 18px 28px; display: inline-block;">
                <span style="font-family: ui-monospace, 'SF Mono', 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; color: #9049f3; letter-spacing: 6px;">{{ .Token }}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding: 0 32px 24px 32px;">
              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #616875;">
                {{ if .Data.otp_expires_minutes }}<strong style="color: #0f121a;">Expires in {{ .Data.otp_expires_minutes }} minutes.</strong>{{ else }}<strong style="color: #0f121a;">Expires in 5 minutes.</strong>{{ end }}
                After that, request a new code from the sign-up screen.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 28px 32px; border-top: 1px solid #edeff2;">
              <p style="margin: 20px 0 0 0; font-size: 13px; line-height: 20px; color: #616875;">If you didn&apos;t request this code, you can ignore this email.</p>
            </td>
          </tr>
        </table>
        <table width="100%" style="max-width: 480px; text-align: center; margin-top: 20px;"><tr><td><p style="margin: 0; font-size: 12px; color: #616875;">&copy; 2026 MusicPromo AI</p></td></tr></table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## Security notifications (optional)

Enable under **Authentication → Email → Security notifications**. Subjects are up to you; copy below matches the same card layout (no OTP or action button unless noted).

### Password changed

Uses `{{ .Email }}`.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password changed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7f9; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f7f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border: 1px solid #dcdfe5; border-radius: 16px; box-shadow: 0 2px 4px rgba(15, 18, 26, 0.04), 0 16px 40px -12px rgba(15, 18, 26, 0.12); overflow: hidden; text-align: left;">
          <tr><td style="height: 4px; background: linear-gradient(120deg, #9049f3, #ec3ca0); font-size: 0; line-height: 0;">&nbsp;</td></tr>
          <tr>
            <td style="padding: 28px 32px 24px 32px; border-bottom: 1px solid #edeff2;">
              <table border="0" cellspacing="0" cellpadding="0"><tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="https://hmqxptxtcejhmuwbegvq.supabase.co/storage/v1/object/public/public-assets/musicpromo-ai-icon-1024.png" alt="MusicPromo AI" width="36" height="36" style="display: block; border: 0; width: 36px; height: 36px; border-radius: 10px;" />
                </td>
                <td style="vertical-align: middle;"><span style="font-size: 20px; font-weight: 700; color: #0f121a;">MusicPromo AI</span></td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 28px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: #0f121a;">Your password was changed</h2>
              <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 24px; color: #616875;">
                The password for <strong style="color: #0f121a;">{{ .Email }}</strong> was updated successfully.
              </p>
              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #616875;">If you didn&apos;t make this change, reset your password immediately and <a href="mailto:support@musicpromoai.site" style="color: #9049f3; font-weight: 600; text-decoration: underline;">contact support</a>.</p>
            </td>
          </tr>
        </table>
        <table width="100%" style="max-width: 480px; text-align: center; margin-top: 20px;"><tr><td><p style="margin: 0; font-size: 12px; color: #616875;">&copy; 2026 MusicPromo AI</p></td></tr></table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Email address changed

Uses `{{ .Email }}`, `{{ .OldEmail }}` (when available).

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email changed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7f9; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f7f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border: 1px solid #dcdfe5; border-radius: 16px; box-shadow: 0 2px 4px rgba(15, 18, 26, 0.04), 0 16px 40px -12px rgba(15, 18, 26, 0.12); overflow: hidden; text-align: left;">
          <tr><td style="height: 4px; background: linear-gradient(120deg, #9049f3, #ec3ca0); font-size: 0; line-height: 0;">&nbsp;</td></tr>
          <tr>
            <td style="padding: 28px 32px 24px 32px; border-bottom: 1px solid #edeff2;">
              <table border="0" cellspacing="0" cellpadding="0"><tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="https://hmqxptxtcejhmuwbegvq.supabase.co/storage/v1/object/public/public-assets/musicpromo-ai-icon-1024.png" alt="MusicPromo AI" width="36" height="36" style="display: block; border: 0; width: 36px; height: 36px; border-radius: 10px;" />
                </td>
                <td style="vertical-align: middle;"><span style="font-size: 20px; font-weight: 700; color: #0f121a;">MusicPromo AI</span></td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 28px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: #0f121a;">Your email address was updated</h2>
              <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 24px; color: #616875;">
                Your MusicPromo AI account email is now <strong style="color: #9049f3;">{{ .Email }}</strong>.
              </p>
              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #616875;">If you didn&apos;t request this change, <a href="mailto:support@musicpromoai.site" style="color: #9049f3; font-weight: 600; text-decoration: underline;">contact support</a> right away.</p>
            </td>
          </tr>
        </table>
        <table width="100%" style="max-width: 480px; text-align: center; margin-top: 20px;"><tr><td><p style="margin: 0; font-size: 12px; color: #616875;">&copy; 2026 MusicPromo AI</p></td></tr></table>
      </td>
    </tr>
  </table>
</body>
</html>
```

### Phone number changed / MFA enrolled (informational)

Uses `{{ .Email }}`. Adjust heading to match the notification type in the dashboard.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Security update</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f6f7f9; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f6f7f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 480px; background-color: #ffffff; border: 1px solid #dcdfe5; border-radius: 16px; box-shadow: 0 2px 4px rgba(15, 18, 26, 0.04), 0 16px 40px -12px rgba(15, 18, 26, 0.12); overflow: hidden; text-align: left;">
          <tr><td style="height: 4px; background: linear-gradient(120deg, #9049f3, #ec3ca0); font-size: 0; line-height: 0;">&nbsp;</td></tr>
          <tr>
            <td style="padding: 28px 32px 24px 32px; border-bottom: 1px solid #edeff2;">
              <table border="0" cellspacing="0" cellpadding="0"><tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <img src="https://hmqxptxtcejhmuwbegvq.supabase.co/storage/v1/object/public/public-assets/musicpromo-ai-icon-1024.png" alt="MusicPromo AI" width="36" height="36" style="display: block; border: 0; width: 36px; height: 36px; border-radius: 10px;" />
                </td>
                <td style="vertical-align: middle;"><span style="font-size: 20px; font-weight: 700; color: #0f121a;">MusicPromo AI</span></td>
              </tr></table>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 28px 32px;">
              <h2 style="margin: 0 0 12px 0; font-size: 22px; font-weight: 600; color: #0f121a;">Security update on your account</h2>
              <p style="margin: 0 0 12px 0; font-size: 15px; line-height: 24px; color: #616875;">
                We detected a security-related change for <strong style="color: #0f121a;">{{ .Email }}</strong>.
              </p>
              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #616875;">If this wasn&apos;t you, review your account settings and <a href="mailto:support@musicpromoai.site" style="color: #9049f3; font-weight: 600; text-decoration: underline;">contact support</a>.</p>
            </td>
          </tr>
        </table>
        <table width="100%" style="max-width: 480px; text-align: center; margin-top: 20px;"><tr><td><p style="margin: 0; font-size: 12px; color: #616875;">&copy; 2026 MusicPromo AI</p></td></tr></table>
      </td>
    </tr>
  </table>
</body>
</html>
```
