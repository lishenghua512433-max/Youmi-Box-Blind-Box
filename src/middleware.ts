import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Anti-crawler / Risk-control Middleware
 * - Detects bots/crawlers (WhatsApp, Telegram, social media previews, SEO bots)
 * - Blocks sensitive API endpoints for non-human traffic
 * - Allows full access for normal browser users
 */

const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /scrapy/i, /headless/i,
  /whatsapp/i, /telegram/i, /facebookexternalhit/i, /facebot/i,
  /twitterbot/i, /linkedinbot/i, /slackbot/i, /discordbot/i,
  /preview/i, /fetch/i, /curl/i, /wget/i, /python/i, /java/i,
  /httpclient/i, /okhttp/i, /apache/i, /node-fetch/i,
  /googleweblight/i, /pagespeed/i, /lighthouse/i,
  /chrome-lighthouse/i, /sitechecker/i, /semrush/i, /ahrefs/i,
  /mj12bot/i, /dotbot/i, /rogerbot/i, /seznambot/i,
];

const SENSITIVE_API_PREFIXES = [
  '/api/market',
  '/api/referral',
  '/api/inventory',
  '/api/transactions',
];

function isBot(userAgent: string): boolean {
  if (!userAgent) return true; // No UA = suspicious
  return BOT_PATTERNS.some(p => p.test(userAgent));
}

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || '';

  // Only check API routes for bot blocking
  if (request.nextUrl.pathname.startsWith('/api/')) {
    if (isBot(ua)) {
      // Block sensitive API access for bots
      const isSensitive = SENSITIVE_API_PREFIXES.some(
        prefix => request.nextUrl.pathname.startsWith(prefix)
      );
      if (isSensitive) {
        return NextResponse.json(
          { success: false, error: 'Access denied' },
          { status: 403 }
        );
      }
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
