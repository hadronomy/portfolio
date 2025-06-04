<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" doctype-public="-//W3C//DTD HTML 4.01//EN" doctype-system="http://www.w3.org/TR/html4/strict.dtd"/>
  
  <xsl:template match="/">
    <html>
      <head>
        <title><xsl:value-of select="/rss/channel/title"/> - RSS Feed</title>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }
          
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            overflow: hidden;
          }
          
          .header {
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            padding: 40px;
            text-align: center;
          }
          
          .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 10px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          
          .header p {
            font-size: 1.1rem;
            opacity: 0.9;
            margin-bottom: 20px;
          }
          
          .rss-info {
            background: rgba(255, 255, 255, 0.1);
            padding: 20px;
            border-radius: 12px;
            margin-top: 20px;
            backdrop-filter: blur(10px);
          }
          
          .rss-info h2 {
            font-size: 1.3rem;
            margin-bottom: 10px;
          }
          
          .rss-info p {
            font-size: 0.95rem;
            line-height: 1.5;
            opacity: 0.9;
          }
          
          .feed-url {
            background: rgba(255, 255, 255, 0.2);
            padding: 10px 15px;
            border-radius: 8px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9rem;
            word-break: break-all;
            margin-top: 10px;
          }
          
          .content {
            padding: 40px;
          }
          
          .posts-header {
            border-bottom: 3px solid #e5e7eb;
            padding-bottom: 15px;
            margin-bottom: 30px;
          }
          
          .posts-header h2 {
            font-size: 1.8rem;
            color: #1f2937;
            font-weight: 600;
          }
          
          .post {
            border-bottom: 1px solid #f3f4f6;
            padding: 25px 0;
            transition: all 0.3s ease;
          }
          
          .post:last-child {
            border-bottom: none;
          }
          
          .post:hover {
            background: #f9fafb;
            margin: 0 -20px;
            padding: 25px 20px;
            border-radius: 12px;
          }
          
          .post-title {
            font-size: 1.3rem;
            font-weight: 600;
            color: #1f2937;
            text-decoration: none;
            display: block;
            margin-bottom: 8px;
            transition: color 0.3s ease;
          }
          
          .post-title:hover {
            color: #4f46e5;
          }
          
          .post-date {
            color: #6b7280;
            font-size: 0.9rem;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
          }
          
          .post-date::before {
            content: "📅";
            margin-right: 8px;
          }
          
          .post-description {
            color: #4b5563;
            line-height: 1.6;
            font-size: 0.95rem;
          }
          
          .footer {
            background: #f9fafb;
            padding: 30px 40px;
            text-align: center;
            color: #6b7280;
            font-size: 0.9rem;
            border-top: 1px solid #e5e7eb;
          }
          
          .footer a {
            color: #4f46e5;
            text-decoration: none;
            font-weight: 500;
          }
          
          .footer a:hover {
            text-decoration: underline;
          }
          
          @media (max-width: 768px) {
            body {
              padding: 10px;
            }
            
            .header {
              padding: 30px 20px;
            }
            
            .header h1 {
              font-size: 2rem;
            }
            
            .content {
              padding: 30px 20px;
            }
            
            .footer {
              padding: 20px;
            }
            
            .post:hover {
              margin: 0 -10px;
              padding: 25px 10px;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1><xsl:value-of select="/rss/channel/title"/></h1>
            <p><xsl:value-of select="/rss/channel/description"/></p>
            
            <div class="rss-info">
              <h2>📡 RSS Feed</h2>
              <p>This is an RSS feed. You can subscribe to it using your favorite RSS reader to stay updated with new posts.</p>
              <div class="feed-url">
                <xsl:value-of select="/rss/channel/link"/>rss.xml
              </div>
            </div>
          </div>
          
          <div class="content">
            <div class="posts-header">
              <h2>Latest Posts (<xsl:value-of select="count(/rss/channel/item)"/>)</h2>
            </div>
            
            <xsl:for-each select="/rss/channel/item">
              <div class="post">
                <a class="post-title" href="{link}">
                  <xsl:value-of select="title"/>
                </a>
                <div class="post-date">
                  <xsl:value-of select="pubDate"/>
                </div>
                <xsl:if test="description">
                  <div class="post-description">
                    <xsl:value-of select="description" disable-output-escaping="yes"/>
                  </div>
                </xsl:if>
              </div>
            </xsl:for-each>
          </div>
          
          <div class="footer">
            <p>
              Powered by <a href="https://astro.build/">Astro</a> • 
              Subscribe to this feed in your RSS reader to stay updated!
            </p>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
