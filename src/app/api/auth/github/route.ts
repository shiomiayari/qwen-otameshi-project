import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.GITHUB_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'GitHub Client ID is not configured' }, { status: 500 });
  }

  const redirectUri = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/callback/github`;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=read:user`;

  return NextResponse.redirect(githubAuthUrl);
}
