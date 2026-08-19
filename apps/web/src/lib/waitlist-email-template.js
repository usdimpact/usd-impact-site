export const WAITLIST_CONFIRMATION_SUBJECT = "You're on the Read the Dollar First waitlist";
export const WAITLIST_BOOK_URL = 'https://www.usd-impact.com/book/read-the-dollar-first/';
export const WAITLIST_PRIVACY_URL = 'https://www.usd-impact.com/privacy/';
export const WAITLIST_SUPPORT_EMAIL = 'support@usd-impact.com';

const WAITLIST_SUPPORT_URL = `mailto:${WAITLIST_SUPPORT_EMAIL}?subject=Read%20the%20Dollar%20First%20waitlist%20support`;

export function buildWaitlistConfirmationEmail() {
  const text = [
    'USD Impact',
    '',
    "You're on the Read the Dollar First waitlist.",
    '',
    'Thank you for joining the waitlist for Read the Dollar First.',
    'We will email the purchase link and essential availability updates when the book becomes available.',
    '',
    `Book details: ${WAITLIST_BOOK_URL}`,
    `Privacy notice: ${WAITLIST_PRIVACY_URL}`,
    '',
    "To leave the waitlist, reply to this email with the word 'unsubscribe'.",
    `Support: ${WAITLIST_SUPPORT_EMAIL}`,
    '',
    'Educational product information only. This is not investment, legal, tax, trading, or financial advice.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${WAITLIST_CONFIRMATION_SUBJECT}</title>
</head>
<body style="margin-top:0; margin-right:0; margin-bottom:0; margin-left:0; padding-top:0; padding-right:0; padding-bottom:0; padding-left:0; width:100%; background-color:#f3f5f7;">
  <span style="display:none; max-height:0; max-width:0; overflow:hidden; opacity:0; color:transparent;">Your place on the Read the Dollar First waitlist is confirmed.</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse; background-color:#f3f5f7;">
    <tr>
      <td align="center" style="padding-top:24px; padding-right:12px; padding-bottom:24px; padding-left:12px;">
        <!--[if mso]>
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; border-collapse:separate; border-spacing:0; background-color:#ffffff; border-top:1px solid #e6e9ed; border-right:1px solid #e6e9ed; border-bottom:1px solid #e6e9ed; border-left:1px solid #e6e9ed;">
          <tr>
            <td bgcolor="#071A33" style="background-color:#071A33; padding-top:24px; padding-right:28px; padding-bottom:24px; padding-left:28px;">
              <p style="margin-top:0; margin-right:0; margin-bottom:8px; margin-left:0; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:18px; letter-spacing:2px; text-transform:uppercase; color:#C9A35B; font-weight:700;">USD Impact</p>
              <p style="margin-top:0; margin-right:0; margin-bottom:0; margin-left:0; font-family:Georgia, 'Times New Roman', serif; font-size:22px; line-height:29px; color:#ffffff;">How the Dollar Moves Global Markets.</p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:32px; padding-right:28px; padding-bottom:28px; padding-left:28px;">
              <h1 style="margin-top:0; margin-right:0; margin-bottom:18px; margin-left:0; font-family:Georgia, 'Times New Roman', serif; font-size:30px; line-height:38px; color:#071A33; font-weight:700;">You&rsquo;re on the waitlist.</h1>
              <p style="margin-top:0; margin-right:0; margin-bottom:14px; margin-left:0; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:25px; color:#161A1F;">Thank you for joining the waitlist for <strong><em>Read the Dollar First</em></strong>.</p>
              <p style="margin-top:0; margin-right:0; margin-bottom:24px; margin-left:0; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:25px; color:#161A1F;">We will email the purchase link and essential availability updates when the book becomes available.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                <tr>
                  <td bgcolor="#071A33" style="background-color:#071A33;">
                    <a href="${WAITLIST_BOOK_URL}" style="display:inline-block; padding-top:13px; padding-right:20px; padding-bottom:13px; padding-left:20px; font-family:Arial, Helvetica, sans-serif; font-size:15px; line-height:20px; color:#ffffff; font-weight:700; text-decoration:none;">View book details</a>
                  </td>
                </tr>
              </table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%; border-collapse:collapse;">
                <tr>
                  <td style="padding-top:28px; border-bottom:1px solid #E6E9ED; font-size:1px; line-height:1px;">&nbsp;</td>
                </tr>
              </table>
              <p style="margin-top:22px; margin-right:0; margin-bottom:10px; margin-left:0; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:21px; color:#5A6472;">You are receiving this confirmation because you explicitly requested book availability updates.</p>
              <p style="margin-top:0; margin-right:0; margin-bottom:10px; margin-left:0; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:21px; color:#5A6472;">To leave the waitlist, reply to this email with the word <strong>unsubscribe</strong>. For help, email <a href="${WAITLIST_SUPPORT_URL}" style="color:#071A33; text-decoration:underline;">${WAITLIST_SUPPORT_EMAIL}</a>.</p>
              <p style="margin-top:0; margin-right:0; margin-bottom:18px; margin-left:0; font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:21px; color:#5A6472;"><a href="${WAITLIST_PRIVACY_URL}" style="color:#071A33; text-decoration:underline;">Read the USD Impact privacy notice</a>.</p>
              <p style="margin-top:0; margin-right:0; margin-bottom:0; margin-left:0; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:19px; color:#5A6472;">Educational product information only. This is not investment, legal, tax, trading, or financial advice.</p>
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;

  return Object.freeze({
    subject: WAITLIST_CONFIRMATION_SUBJECT,
    text,
    html,
  });
}
