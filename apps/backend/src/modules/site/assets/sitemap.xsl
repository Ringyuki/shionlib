<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <xsl:output method="html" indent="yes" encoding="UTF-8"/>
  <xsl:template match="/">
    <html>
      <head>
        <title>Shionlib Sitemap</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <style>
          :root{
            --radius: 0.625rem;
            --primary-50: #f2fbff;
            --primary-100: #e6f7fe;
            --primary-200: #c5ebfb;
            --primary-300: #a3def7;
            --primary-400: #7ed0f2;
            --primary-500: #4cb8ea;
            --primary-600: #34a2d5;
            --primary-700: #2784b0;
            --primary-800: #206a8e;
            --primary-900: #1c5774;
            --primary-950: #0e2f40;

            --success-50: #f0fdf4;
            --success-100: #dcfce7;
            --success-200: #bbf7d0;
            --success-300: #86efac;
            --success-400: #4ade80;
            --success-500: #22c55e;
            --success-600: #16a34a;
            --success-700: #15803d;
            --success-800: #166534;
            --success-900: #14532d;
            --success-950: #052e16;

            --warning-50: #fffbeb;
            --warning-100: #fef3c7;
            --warning-200: #fde68a;
            --warning-300: #fcd34d;
            --warning-400: #fbbf24;
            --warning-500: #f59e0b;
            --warning-600: #d97706;
            --warning-700: #b45309;
            --warning-800: #92400e;
            --warning-900: #78350f;
            --warning-950: #451a03;

            --info-50: #ecfeff;
            --info-100: #cffafe;
            --info-200: #a5f3fc;
            --info-300: #67e8f9;
            --info-400: #22d3ee;
            --info-500: #06b6d4;
            --info-600: #0891b2;
            --info-700: #0e7490;
            --info-800: #155e75;
            --info-900: #164e63;
            --info-950: #083344;

            --danger-50: #fef2f2;
            --danger-100: #fee2e2;
            --danger-200: #fecaca;
            --danger-300: #fca5a5;
            --danger-400: #f87171;
            --danger-500: #ef4444;
            --danger-600: #dc2626;
            --danger-700: #b91c1c;
            --danger-800: #991b1b;
            --danger-900: #7f1d1d;
            --danger-950: #450a0a;

            --neutral-50: #f9fafb;
            --neutral-100: #f3f4f6;
            --neutral-200: #e5e7eb;
            --neutral-300: #d1d5db;
            --neutral-400: #9ca3af;
            --neutral-500: #6b7280;
            --neutral-600: #4b5563;
            --neutral-700: #374151;
            --neutral-800: #1f2937;
            --neutral-900: #111827;
            --neutral-950: #0a0f1a;

            --background: oklch(1 0 0);
            --foreground: oklch(0.145 0 0);
            --card: oklch(1 0 0);
            --card-foreground: oklch(0.145 0 0);
            --card-muted: var(--neutral-100);
            --card-hover: var(--neutral-50);
            --card-border: var(--border);
            --primary: var(--primary-600);
            --primary-foreground: #ffffff;
            --muted: var(--neutral-100);
            --muted-foreground: var(--neutral-400);
            --border: var(--neutral-200);
            --ring: var(--primary-500);
          }
          *{box-sizing:border-box;}
          body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,"Noto Sans","Apple Color Emoji","Segoe UI Emoji";color:var(--foreground);background:var(--background);}
          .header{padding:28px 24px;border-bottom:1px solid var(--border);background:var(--card);position:sticky;top:0;z-index:1;}
          .brand{font-size:20px;font-weight:700;color:var(--primary);}
          .meta{margin-top:6px;color:var(--muted-foreground);font-size:13px;}
          .container{max-width:1080px;margin:0 auto;padding:20px 24px 40px;}
          .card{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:0 4px 14px rgba(15,23,42,0.06);}
          .table{width:100%;border-collapse:collapse;font-size:14px;}
          .table th{background:var(--card-muted);text-align:left;padding:12px 14px;border-bottom:1px solid var(--border);color:var(--muted-foreground);font-weight:600;}
          .table td{padding:12px 14px;border-bottom:1px solid var(--border);vertical-align:top;}
          .table tr:hover td{background:var(--card-hover);}
          .badge{display:inline-block;padding:2px 8px;border-radius:999px;background:var(--accent);color:var(--accent-foreground);font-size:12px;font-weight:600;}
          .link{color:var(--primary);text-decoration:none;word-break:break-all;}
          .link:hover{text-decoration:underline;}
          .empty{padding:24px;color:var(--muted-foreground);}
          @media (prefers-color-scheme: dark){
            :root{
              --background: oklch(0.145 0 0);
              --foreground: oklch(0.985 0 0);
              --card: oklch(0.205 0 0);
              --card-foreground: oklch(0.985 0 0);
              --card-muted: oklch(0.269 0 0);
              --card-hover: oklch(0.24 0 0);
              --border: oklch(1 0 0 / 10%);
              --muted: oklch(0.269 0 0);
              --muted-foreground: oklch(0.708 0 0);
              --accent: var(--primary-900);
              --accent-foreground: var(--primary-100);
              --primary: var(--primary-600);
            }
            .card{box-shadow:0 4px 14px rgba(0,0,0,0.4);}
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">Shionlib Sitemap</div>
          <div class="meta">Generated by Shionlib Backend</div>
        </div>
        <div class="container">
          <div class="card">
            <xsl:choose>
              <xsl:when test="s:sitemapindex">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Location</th>
                      <th>Last Modified</th>
                    </tr>
                  </thead>
                  <tbody>
                    <xsl:for-each select="s:sitemapindex/s:sitemap">
                      <tr>
                        <td><a class="link" href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                        <td><xsl:value-of select="s:lastmod"/></td>
                      </tr>
                    </xsl:for-each>
                  </tbody>
                </table>
              </xsl:when>
              <xsl:when test="s:urlset">
                <table class="table">
                  <thead>
                    <tr>
                      <th>URL</th>
                      <th>Last Modified</th>
                      <th>Changefreq</th>
                      <th>Priority</th>
                      <th>Alternates</th>
                    </tr>
                  </thead>
                  <tbody>
                    <xsl:for-each select="s:urlset/s:url">
                      <tr>
                        <td><a class="link" href="{s:loc}"><xsl:value-of select="s:loc"/></a></td>
                        <td><xsl:value-of select="s:lastmod"/></td>
                        <td><span class="badge"><xsl:value-of select="s:changefreq"/></span></td>
                        <td><span class="badge"><xsl:value-of select="s:priority"/></span></td>
                        <td>
                          <xsl:for-each select="xhtml:link">
                            <div><span class="badge"><xsl:value-of select="@hreflang"/></span> <a class="link" href="{@href}"><xsl:value-of select="@href"/></a></div>
                          </xsl:for-each>
                        </td>
                      </tr>
                    </xsl:for-each>
                  </tbody>
                </table>
              </xsl:when>
              <xsl:otherwise>
                <div class="empty">No sitemap entries.</div>
              </xsl:otherwise>
            </xsl:choose>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
