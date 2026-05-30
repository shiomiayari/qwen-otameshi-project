import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return new NextResponse('No code provided', { status: 400 });
  }

  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/callback/discord`;

  try {
    // 1. Exchange code for access token (Discord requires x-www-form-urlencoded)
    const tokenParams = new URLSearchParams({
      client_id: clientId as string,
      client_secret: clientSecret as string,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('Discord token error:', tokenData);
      return new NextResponse('Failed to obtain access token', { status: 400 });
    }

    // 2. Fetch user profile
    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userData = await userResponse.json();

    // Use the numeric Snowflake ID (18 digits) for deep-link QR codes.
    // userData.id is always present and numeric for every Discord account.
    const discordId: string = userData.id;

    if (!discordId || !/^\d+$/.test(discordId)) {
      console.error('Discord user data missing or invalid id:', userData);
      return new NextResponse('Failed to obtain Discord user ID', { status: 400 });
    }

    // 3. Return HTML that sends postMessage to parent window and closes itself
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Discord Authorization Successful</title>
      </head>
      <body>
        <p>Authorization successful. Returning to the app...</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'OAUTH_SUCCESS',
              service: 'discord',
              discordId: '${discordId}'
            }, '*');
            window.close();
          } else {
            document.body.innerHTML = 'Please close this window and return to the application.';
          }
        </script>
      </body>
      </html>
    `;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Discord OAuth Callback Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
