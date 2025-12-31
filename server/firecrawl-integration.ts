/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ORACLE AI - Q++RS ULTIMATE 5.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * Author: Jonathan Sherman
 * Sovereign ID: 1
 * Copyright (c) 2024-2025 Jonathan Sherman. All Rights Reserved.
 * Signature: Sm9uYXRoYW4gU2hlcm1hbjo6U292ZXJlaWduOjoxOjpPcmFjbGVBSTo6USsrUlM=
 * 
 * FIRECRAWL INTEGRATION
 * Web Data API for AI - LLM-Ready Content Extraction
 * Protected under OWP (Ownership Watermark Protocol)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import SovereignLockdown from './sovereign-lockdown';

const FIRECRAWL_API_BASE = 'https://api.firecrawl.dev/v1';

interface ScrapeOptions {
  formats?: ('markdown' | 'html' | 'screenshot' | 'links')[];
  onlyMainContent?: boolean;
  includeTags?: string[];
  excludeTags?: string[];
  waitFor?: number;
}

interface ScrapeResult {
  success: boolean;
  data?: {
    markdown?: string;
    html?: string;
    screenshot?: string;
    links?: string[];
    metadata?: {
      title?: string;
      description?: string;
      language?: string;
      sourceURL?: string;
    };
  };
  error?: string;
}

interface CrawlOptions {
  limit?: number;
  scrapeOptions?: ScrapeOptions;
  excludePaths?: string[];
  includePaths?: string[];
}

interface CrawlResult {
  success: boolean;
  jobId?: string;
  status?: 'pending' | 'running' | 'completed' | 'failed';
  data?: ScrapeResult[];
  error?: string;
}

interface SearchOptions {
  limit?: number;
  scrapeOptions?: ScrapeOptions;
}

interface SearchResult {
  success: boolean;
  data?: {
    url: string;
    title: string;
    description: string;
    content?: string;
  }[];
  error?: string;
}

function getApiKey(): string {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) {
    throw new Error('FIRECRAWL_API_KEY not configured');
  }
  return key;
}

async function firecrawlRequest(
  endpoint: string,
  method: 'GET' | 'POST' = 'POST',
  body?: object
): Promise<any> {
  const response = await fetch(`${FIRECRAWL_API_BASE}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firecrawl API error: ${response.status} - ${error}`);
  }

  return response.json();
}

export async function scrapeUrl(
  url: string,
  options: ScrapeOptions = {}
): Promise<ScrapeResult> {
  try {
    const result = await firecrawlRequest('/scrape', 'POST', {
      url,
      formats: options.formats || ['markdown'],
      onlyMainContent: options.onlyMainContent ?? true,
      includeTags: options.includeTags,
      excludeTags: options.excludeTags,
      waitFor: options.waitFor,
    });

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function crawlWebsite(
  url: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  try {
    const result = await firecrawlRequest('/crawl', 'POST', {
      url,
      limit: options.limit || 10,
      scrapeOptions: options.scrapeOptions || { formats: ['markdown'] },
      excludePaths: options.excludePaths,
      includePaths: options.includePaths,
    });

    return {
      success: true,
      jobId: result.id,
      status: result.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function getCrawlStatus(jobId: string): Promise<CrawlResult> {
  try {
    const result = await firecrawlRequest(`/crawl/${jobId}`, 'GET');

    return {
      success: true,
      jobId,
      status: result.status,
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function mapWebsite(url: string): Promise<{ success: boolean; urls?: string[]; error?: string }> {
  try {
    const result = await firecrawlRequest('/map', 'POST', { url });

    return {
      success: true,
      urls: result.links || result.urls,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function searchWeb(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult> {
  try {
    const result = await firecrawlRequest('/search', 'POST', {
      query,
      limit: options.limit || 5,
      scrapeOptions: options.scrapeOptions,
    });

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function extractData(
  urls: string[],
  prompt: string,
  schema?: object
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const body: any = {
      urls,
      prompt,
    };

    if (schema) {
      body.schema = schema;
    }

    const result = await firecrawlRequest('/extract', 'POST', body);

    return {
      success: true,
      data: result.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export const Firecrawl = {
  scrape: scrapeUrl,
  crawl: crawlWebsite,
  getCrawlStatus,
  map: mapWebsite,
  search: searchWeb,
  extract: extractData,
};

export default Firecrawl;

console.log('[FIRECRAWL] Integration loaded');
