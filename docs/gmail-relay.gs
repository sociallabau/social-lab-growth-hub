/**
 * Social Lab Growth Hub - Gmail relay
 *
 * Lets the dashboard send the Monday summary from your own Gmail account,
 * with no domain verification and no third-party email service.
 *
 * Setup (about 5 minutes, once):
 *  1. Go to script.google.com and choose "New project". Name it "Social Lab Growth Hub mailer".
 *  2. Delete whatever is in the editor and paste this whole file in.
 *  3. Replace the SHARED_SECRET value below with a long random string, and keep a copy.
 *     Change that one line only: everything else stays as it is.
 *  4. Press Deploy > New deployment > type "Web app".
 *       Execute as: Me
 *       Who has access: Anyone
 *     "Anyone" is safe here: the script refuses every request that does not carry the secret.
 *  5. Authorise it when Google asks. The warning screen is expected for your own script:
 *     choose Advanced, then "Go to ... (unsafe)".
 *  6. Copy the web app URL it gives you (it ends in /exec).
 *  7. In Lovable Cloud, add two secrets:
 *       GMAIL_RELAY_URL     = that /exec URL
 *       GMAIL_RELAY_SECRET  = the same random string as below
 *
 * Gmail's own sending limits apply (about 100 recipients a day on a personal
 * account, 1,500 on Workspace), which is far more than one weekly email needs.
 */

const PLACEHOLDER = 'replace-me-with-a-long-random-string';
const SHARED_SECRET = PLACEHOLDER; // <- put your own long random string here

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    if (!SHARED_SECRET || SHARED_SECRET === PLACEHOLDER) {
      return json({ ok: false, error: 'Set SHARED_SECRET in the Apps Script first' });
    }
    if (body.secret !== SHARED_SECRET) {
      return json({ ok: false, error: 'Bad secret' });
    }

    const to = [].concat(body.to || []).filter(String);
    if (!to.length) return json({ ok: false, error: 'No recipients' });
    if (!body.subject) return json({ ok: false, error: 'No subject' });

    MailApp.sendEmail({
      to: to.join(','),
      subject: String(body.subject),
      htmlBody: String(body.html || ''),
      body: String(body.text || ''),
      name: body.fromName ? String(body.fromName) : 'Social Lab Growth Hub',
    });

    return json({ ok: true, sent: to.length });
  } catch (error) {
    return json({ ok: false, error: String(error) });
  }
}

/** Lets you confirm the deployment is live by opening the URL in a browser. */
function doGet() {
  return json({ ok: true, service: 'Social Lab Growth Hub mailer' });
}

function json(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
