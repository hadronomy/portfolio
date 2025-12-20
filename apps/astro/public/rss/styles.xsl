<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" doctype-public="-//W3C//DTD HTML 4.01//EN" doctype-system="http://www.w3.org/TR/html4/strict.dtd"/>
  
  <xsl:template match="/">
    <html lang="en">
      <head>
        <title>RSS_FEED // <xsl:value-of select="/rss/channel/title"/></title>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <style>
          :root {
            --bg: #050505;
            --fg: #e5e5e5;
            --border: #333;
            --accent: #22c55e;
            --muted: #888;
            --font-mono: 'Menlo', 'Monaco', 'Courier New', monospace;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: var(--font-mono);
            background-color: var(--bg);
            color: var(--fg);
            line-height: 1.5;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            overflow-x: hidden;
          }

          /* Utility Grid Background */
          .bg-grid {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
              linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px);
            background-size: 40px 40px;
            pointer-events: none;
            z-index: 0;
          }

          .layout {
            position: relative;
            z-index: 1;
            max-width: 1200px;
            margin: 0 auto;
            width: 100%;
            border-left: 1px solid var(--border);
            border-right: 1px solid var(--border);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }

          /* Header */
          header {
            border-bottom: 1px solid var(--border);
            padding: 40px;
            background: rgba(255,255,255,0.02);
          }

          h1 {
            font-size: 2rem;
            text-transform: uppercase;
            letter-spacing: -1px;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 15px;
          }

          h1::before {
            content: '';
            display: block;
            width: 15px;
            height: 15px;
            background: var(--accent);
            box-shadow: 0 0 10px var(--accent);
          }

          .subtitle {
            color: var(--muted);
            font-size: 0.9rem;
            max-width: 600px;
          }

          /* Metadata Bar */
          .meta-bar {
            display: flex;
            border-bottom: 1px solid var(--border);
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .meta-item {
            padding: 15px 20px;
            border-right: 1px solid var(--border);
            display: flex;
            gap: 10px;
            align-items: center;
          }

          .label { color: var(--muted); }
          .value { color: var(--fg); font-weight: bold; }

          /* Feed Content */
          .feed-container {
            display: grid;
            grid-template-columns: 300px 1fr;
          }

          /* Sidebar */
          .sidebar {
            border-right: 1px solid var(--border);
            padding: 30px;
          }

          .info-box {
            border: 1px solid var(--border);
            padding: 20px;
            margin-bottom: 20px;
            background: rgba(0,0,0,0.5);
          }

          .info-title {
            font-size: 0.8rem;
            text-transform: uppercase;
            color: var(--muted);
            margin-bottom: 10px;
            display: block;
            border-bottom: 1px solid var(--border);
            padding-bottom: 5px;
          }

          .xml-link {
            display: block;
            background: rgba(255,255,255,0.1);
            padding: 10px;
            font-size: 0.7rem;
            word-break: break-all;
            color: var(--accent);
            text-decoration: none;
            margin-top: 5px;
          }

          .xml-link:hover {
            background: rgba(255,255,255,0.2);
          }

          /* Entries */
          .entries {
            padding: 0;
          }

          .entry {
            display: block;
            text-decoration: none;
            color: inherit;
            border-bottom: 1px solid var(--border);
            padding: 30px;
            transition: background 0.2s;
            position: relative;
          }

          .entry:hover {
            background: rgba(255,255,255,0.03);
          }

          .entry:hover::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 4px;
            background: var(--accent);
          }

          .entry-header {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            margin-bottom: 10px;
          }

          .entry-title {
            font-size: 1.2rem;
            font-weight: bold;
            color: var(--fg);
          }

          .entry-date {
            font-size: 0.75rem;
            color: var(--muted);
            text-transform: uppercase;
          }

          .entry-desc {
            font-size: 0.9rem;
            color: var(--muted);
            line-height: 1.6;
          }

          /* Footer */
          footer {
            padding: 30px;
            text-align: center;
            font-size: 0.75rem;
            color: var(--muted);
            border-top: 1px solid var(--border);
            text-transform: uppercase;
            letter-spacing: 2px;
          }

          footer a {
            color: var(--fg);
            text-decoration: underline;
          }

          @media (max-width: 800px) {
            .feed-container { grid-template-columns: 1fr; }
            .sidebar { border-right: none; border-bottom: 1px solid var(--border); }
            .entry-header { flex-direction: column; gap: 5px; }
          }
        </style>
      </head>
      <body>
        <div class="bg-grid"></div>
        
        <div class="layout">
          <header>
            <h1><xsl:value-of select="/rss/channel/title"/></h1>
            <div class="subtitle"><xsl:value-of select="/rss/channel/description"/></div>
          </header>

          <div class="meta-bar">
            <div class="meta-item">
              <span class="label">Protocol:</span>
              <span class="value">RSS 2.0</span>
            </div>
            <div class="meta-item">
              <span class="label">Language:</span>
              <span class="value"><xsl:value-of select="/rss/channel/language"/></span>
            </div>
            <div class="meta-item">
              <span class="label">Items:</span>
              <span class="value"><xsl:value-of select="count(/rss/channel/item)"/></span>
            </div>
          </div>

          <div class="feed-container">
            <aside class="sidebar">
              <div class="info-box">
                <span class="info-title">Feed Source</span>
                <p style="font-size: 0.8rem; margin-bottom: 10px; color: #ccc;">
                  This is a raw data stream. Subscribe using a compliant reader.
                </p>
                <a class="xml-link" href="#">
                  <xsl:value-of select="/rss/channel/link"/>rss.xml
                </a>
              </div>
              
              <div class="info-box">
                <span class="info-title">Sys_Admin</span>
                <p style="font-size: 0.8rem; color: #ccc;">Pablo Hernández</p>
              </div>
            </aside>

            <main class="entries">
              <xsl:for-each select="/rss/channel/item">
                <a class="entry" href="{link}" target="_blank">
                  <div class="entry-header">
                    <span class="entry-title"><xsl:value-of select="title"/></span>
                    <span class="entry-date"><xsl:value-of select="pubDate"/></span>
                  </div>
                  <div class="entry-desc">
                    <xsl:value-of select="description"/>
                  </div>
                </a>
              </xsl:for-each>
            </main>
          </div>

          <footer>
            Generated by Astro // System Online
          </footer>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>