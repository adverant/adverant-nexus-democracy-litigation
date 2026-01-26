/**
 * Democracy Litigation API Catch-All Proxy
 *
 * Proxies all requests from /api/democracy-litigation/* to the backend Democracy Litigation service.
 * This allows the dashboard to make relative API calls without CORS issues.
 *
 * Security:
 * - Extracts user ID from validated auth token (NOT from client headers)
 * - Rate limits requests (60 reads/min, 30 writes/min per user)
 * - Sanitizes error responses
 *
 * Integration:
 * - Supports GeoAgent integration via /geographic endpoint
 * - Handles document uploads (multipart/form-data)
 * - Supports long-running operations (job polling)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getUserContext,
  checkRateLimit,
  getRateLimitKey,
  rateLimitResponse,
  errorResponse,
  securityHeaders,
} from '@/lib/api-security'

const DEMOCRACY_LITIGATION_API_URL =
  process.env.DEMOCRACY_LITIGATION_API_URL || 'https://api.adverant.ai/democracy-litigation/api/v1'

// Rate limits (per plan: 60 reads/min, 30 writes/min)
const READ_LIMIT = 60 // 60 reads per minute
const WRITE_LIMIT = 30 // 30 writes per minute
const RATE_WINDOW_MS = 60 * 1000

interface RouteParams {
  params: Promise<{ path: string[] }>
}

async function proxyRequest(request: NextRequest, routeParams: RouteParams, method: string) {
  try {
    // Rate limit check
    const isWrite = method !== 'GET' && method !== 'HEAD'
    const rateLimitKey = getRateLimitKey(
      request,
      isWrite ? 'democracy-litigation-write' : 'democracy-litigation-read'
    )
    const rateLimit = await checkRateLimit(
      rateLimitKey,
      isWrite ? WRITE_LIMIT : READ_LIMIT,
      RATE_WINDOW_MS
    )
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit.resetAt)
    }

    // Authenticate and get user context
    const user = await getUserContext(request)
    console.log(
      '[Democracy Litigation Proxy] User context:',
      user ? { userId: user.userId, tenantId: user.tenantId } : 'null'
    )
    if (!user) {
      return errorResponse('Authentication required', 401, 'AUTH_REQUIRED')
    }

    const { path } = await routeParams.params
    const pathString = path.join('/')
    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()
    const url = `${DEMOCRACY_LITIGATION_API_URL}/${pathString}${queryString ? `?${queryString}` : ''}`

    // Build headers with user ID from validated token (NOT from client header)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Forward auth token for backend validation
    const authHeader = request.headers.get('authorization')
    if (authHeader) {
      headers['Authorization'] = authHeader
    }

    // SECURITY: Use user ID from validated token, NOT from client header
    // This prevents user ID spoofing attacks
    if (user.userId && user.userId !== 'pending-validation') {
      headers['X-User-ID'] = user.userId
    }

    // Forward tenant/organization context from validated token
    if (user.tenantId) {
      headers['X-Tenant-ID'] = user.tenantId
    }
    if (user.organizationId) {
      headers['X-Organization-ID'] = user.organizationId
    }

    // Forward request ID for tracing (this is safe as it's just for logging)
    const requestIdHeader = request.headers.get('x-request-id')
    if (requestIdHeader) {
      headers['X-Request-ID'] = requestIdHeader
    }

    // Check if this is a multipart/form-data request (file upload)
    const contentType = request.headers.get('content-type') || ''
    const isMultipart = contentType.includes('multipart/form-data')

    const fetchOptions: RequestInit = {
      method,
      headers: isMultipart ? {} : headers, // Let browser set Content-Type for multipart
      signal: AbortSignal.timeout(120000), // 120s timeout for file uploads and long operations
    }

    // Include body for methods that support it
    let requestBody = ''
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        if (isMultipart) {
          // For multipart/form-data, forward the FormData directly
          const formData = await request.formData()
          fetchOptions.body = formData as any
          // Add auth headers manually for FormData
          if (authHeader) {
            ;(fetchOptions.headers as any)['Authorization'] = authHeader
          }
          if (user.userId && user.userId !== 'pending-validation') {
            ;(fetchOptions.headers as any)['X-User-ID'] = user.userId
          }
        } else {
          // For JSON requests
          requestBody = await request.text()
          if (requestBody) {
            fetchOptions.body = requestBody
          }
        }
      } catch (bodyError) {
        console.error('[Democracy Litigation Proxy] Failed to read request body:', bodyError)
      }
    }

    console.log('[Democracy Litigation Proxy] Forwarding to:', url)
    console.log('[Democracy Litigation Proxy] Method:', method)
    if (method === 'POST' && requestBody && !isMultipart) {
      console.log('[Democracy Litigation Proxy] Body preview:', requestBody.substring(0, 500))
    }

    const response = await fetch(url, fetchOptions)
    console.log('[Democracy Litigation Proxy] Backend response status:', response.status)

    // Handle binary responses (like document downloads)
    const responseContentType = response.headers.get('content-type') || ''
    if (
      responseContentType.includes('application/octet-stream') ||
      responseContentType.includes('application/zip') ||
      responseContentType.includes('application/pdf')
    ) {
      const buffer = await response.arrayBuffer()
      return new NextResponse(buffer, {
        status: response.status,
        headers: {
          ...securityHeaders(),
          'Content-Type': responseContentType,
          'Content-Disposition': response.headers.get('content-disposition') || '',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        },
      })
    }

    // Handle error responses
    if (!response.ok) {
      if (response.status === 401) {
        return errorResponse('Authentication failed', 401, 'AUTH_FAILED')
      }
      if (response.status === 403) {
        return errorResponse('Access denied', 403, 'ACCESS_DENIED')
      }
      if (response.status === 404) {
        return errorResponse('Resource not found', 404, 'NOT_FOUND')
      }

      // For other errors, try to get the error message from response
      try {
        const errorText = await response.text()
        console.error('[Democracy Litigation Proxy] Backend error response:', response.status, errorText)
        try {
          const errorData = JSON.parse(errorText)
          return NextResponse.json(errorData, {
            status: response.status,
            headers: {
              ...securityHeaders(),
              'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            },
          })
        } catch {
          return errorResponse(errorText || 'Request failed', response.status, 'REQUEST_FAILED')
        }
      } catch (readError) {
        console.error('[Democracy Litigation Proxy] Failed to read error response:', readError)
        return errorResponse('Request failed', response.status, 'REQUEST_FAILED')
      }
    }

    // Handle JSON responses
    const data = await response.json()
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        ...securityHeaders(),
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
      },
    })
  } catch (error) {
    console.error(`Democracy Litigation proxy error (${method}):`, error)
    // Don't expose internal error details to clients
    return errorResponse('Failed to connect to Democracy Litigation service', 503, 'SERVICE_UNAVAILABLE')
  }
}

export async function GET(request: NextRequest, params: RouteParams) {
  return proxyRequest(request, params, 'GET')
}

export async function POST(request: NextRequest, params: RouteParams) {
  return proxyRequest(request, params, 'POST')
}

export async function PUT(request: NextRequest, params: RouteParams) {
  return proxyRequest(request, params, 'PUT')
}

export async function PATCH(request: NextRequest, params: RouteParams) {
  return proxyRequest(request, params, 'PATCH')
}

export async function DELETE(request: NextRequest, params: RouteParams) {
  return proxyRequest(request, params, 'DELETE')
}
