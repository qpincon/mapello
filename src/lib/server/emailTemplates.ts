const FONT = `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
const LOGO_URL = `https://mapello.net/logo_wordmark_transparent.png`;

export function buildTransactionalEmail(opts: {
	preheader: string;
	heading: string;
	intro: string;
	ctaLabel: string;
	ctaUrl: string;
	expiryNote?: string;
}): { html: string; text: string } {
	const expiry = opts.expiryNote ?? 'This link expires in 1 hour.';
	const escapedUrl = opts.ctaUrl.replace(/&/g, '&amp;');

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<title>${opts.heading}</title>
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:${FONT};">
  <!-- preheader -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${opts.preheader}&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;">

          <!-- card -->
          <tr>
            <td style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:40px 36px;">

              <!-- logo -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-bottom:24px;border-bottom:1px solid #e2e8f0;">
                    <img src="${LOGO_URL}" alt="Mapello" width="140" height="auto"
                         style="display:block;height:auto;border:0;" />
                  </td>
                </tr>

                <!-- heading -->
                <tr>
                  <td style="padding-top:28px;padding-bottom:12px;">
                    <p style="margin:0;font-size:22px;font-weight:600;color:#1e293b;line-height:1.3;">${opts.heading}</p>
                  </td>
                </tr>

                <!-- intro -->
                <tr>
                  <td style="padding-bottom:28px;">
                    <p style="margin:0;font-size:15px;color:#475569;line-height:1.65;">${opts.intro}</p>
                  </td>
                </tr>

                <!-- CTA button -->
                <tr>
                  <td style="padding-bottom:28px;">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
                      href="${escapedUrl}" style="height:44px;v-text-anchor:middle;width:200px;" arcsize="18%"
                      fillcolor="#2a7d6e" strokecolor="#2a7d6e">
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;">${opts.ctaLabel}</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-->
                    <a href="${escapedUrl}"
                       style="display:inline-block;background:#2a7d6e;color:#ffffff;font-family:${FONT};font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;line-height:1;">
                      ${opts.ctaLabel}
                    </a>
                    <!--<![endif]-->
                  </td>
                </tr>

                <!-- fallback link -->
                <tr>
                  <td style="padding-bottom:8px;">
                    <p style="margin:0 0 4px;font-size:13px;color:#94a3b8;">Or paste this link into your browser:</p>
                    <p style="margin:0;font-size:12px;color:#506784;word-break:break-all;line-height:1.5;">
                      <a href="${escapedUrl}" style="color:#506784;text-decoration:underline;">${opts.ctaUrl}</a>
                    </p>
                  </td>
                </tr>

                <!-- expiry -->
                <tr>
                  <td style="padding-bottom:0;">
                    <p style="margin:0;font-size:13px;color:#94a3b8;">${expiry}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- footer -->
          <tr>
            <td style="padding:24px 4px 8px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;font-style:italic;color:#64748b;">Maps you'll be proud to embed.</p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">&copy; 2026 Mapello</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

	const text = [
		opts.heading,
		'',
		opts.intro,
		'',
		opts.ctaUrl,
		'',
		expiry,
		'',
		'— Maps you\'ll be proud to embed.',
		'© 2026 Mapello',
	].join('\n');

	return { html, text };
}
