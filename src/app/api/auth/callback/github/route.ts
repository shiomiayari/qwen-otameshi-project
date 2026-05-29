import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');

  if (!code) {
    return new NextResponse('No code provided', { status: 400 });
  }

  const clientId = process.env.GITHUB_ID;
  const clientSecret = process.env.GITHUB_SECRET;
  const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/callback/github`;

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error('GitHub token error:', tokenData);
      return new NextResponse('Failed to obtain access token', { status: 400 });
    }

    // 2. Fetch user profile
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const userData = await userResponse.json();
    const username = userData.login;

    if (!username) {
      return new NextResponse('Failed to obtain username', { status: 400 });
    }

    // 3. Return HTML that sends postMessage to parent window and closes itself
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>GitHub Authorization Successful</title>
      </head>
      <body>
        <p>Authorization successful. Returning to the app...</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'OAUTH_SUCCESS',
              service: 'github',
              username: '${username}'
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
    console.error('GitHub OAuth Callback Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
