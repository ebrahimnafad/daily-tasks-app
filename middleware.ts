import { jwtVerify } from 'jose';

export const config = {
  matcher: '/api/:path*',
};

export default async function middleware(request: Request) {
  const url = new URL(request.url);

  // Bypass public routes
  if (url.pathname.startsWith('/api/auth') || url.pathname.startsWith('/api/webhooks')) {
    return new Response(null, { headers: { 'x-middleware-next': '1' } });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'غير مصرح — يرجى تسجيل الدخول' }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error('JWT_SECRET is missing in environment variables');
    return Response.json({ error: 'Internal Server Error' }, { status: 500 });
  }

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));

    // To forward headers to the underlying Node.js API in Vercel Middleware:
    // We add 'x-middleware-next': '1' to tell Vercel to continue the request.
    // We add 'x-middleware-request-<header>' to inject headers into the downstream request.
    const headers = new Headers();
    headers.set('x-middleware-next', '1');

    if (payload.userId) {
      headers.set('x-middleware-request-x-user-id', String(payload.userId));
    }
    if (payload.username) {
      headers.set('x-middleware-request-x-username', String(payload.username));
    }

    return new Response(null, { headers });
  } catch (error) {
    return Response.json(
      { error: 'جلسة منتهية الصلاحية — يرجى تسجيل الدخول مجدداً' },
      { status: 401 }
    );
  }
}
