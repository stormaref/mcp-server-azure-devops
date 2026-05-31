import { Request, Response, NextFunction } from 'express';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function getConfiguredLogLevel(): LogLevel {
  const level = (process.env.LOG_LEVEL || 'info').toLowerCase();
  if (level in LOG_LEVELS) {
    return level as LogLevel;
  }
  return 'info';
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[getConfiguredLogLevel()];
}

function writeLog(
  level: LogLevel,
  message: string,
  details?: Record<string, unknown>,
): void {
  if (!shouldLog(level)) {
    return;
  }

  const payload = details ? ` ${JSON.stringify(details)}` : '';
  process.stderr.write(
    `${new Date().toISOString()} [${level.toUpperCase()}] ${message}${payload}\n`,
  );
}

function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0]?.trim();
  }
  return req.ip;
}

function summarizeJsonRpcBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') {
    return {};
  }

  const messages = Array.isArray(body) ? body : [body];
  const rpcMethods = messages
    .map((message) =>
      message && typeof message === 'object' && 'method' in message
        ? String((message as { method?: unknown }).method)
        : undefined,
    )
    .filter(Boolean);

  const toolNames = messages
    .filter(
      (message) =>
        message &&
        typeof message === 'object' &&
        (message as { method?: unknown }).method === 'tools/call',
    )
    .map((message) => (message as { params?: { name?: unknown } }).params?.name)
    .filter(Boolean);

  return {
    rpcMethods,
    toolNames,
    isInitialize: messages.some((message) => isInitializeRequest(message)),
    messageCount: messages.length,
  };
}

export function logMcpEvent(
  level: LogLevel,
  message: string,
  details?: Record<string, unknown>,
): void {
  writeLog(level, message, details);
}

export function createMcpRequestLogger(
  getSessionId: (req: Request) => string | undefined,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = Date.now();
    const sessionId = getSessionId(req);
    const requestDetails: Record<string, unknown> = {
      method: req.method,
      path: req.originalUrl || req.path,
      sessionId: sessionId ?? null,
      clientIp: getClientIp(req),
      userAgent: req.headers['user-agent'],
    };

    if (req.method === 'POST') {
      Object.assign(requestDetails, summarizeJsonRpcBody(req.body));
    }

    writeLog('info', 'MCP request received', requestDetails);

    if (shouldLog('debug')) {
      writeLog('debug', 'MCP request headers', {
        accept: req.headers.accept,
        contentType: req.headers['content-type'],
        lastEventId: req.headers['last-event-id'],
      });
    }

    res.on('finish', () => {
      const responseDetails: Record<string, unknown> = {
        method: req.method,
        path: req.originalUrl || req.path,
        sessionId: sessionId ?? res.getHeader('mcp-session-id') ?? null,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      };

      const level: LogLevel = res.statusCode >= 500 ? 'error' : 'info';
      writeLog(level, 'MCP request completed', responseDetails);
    });

    next();
  };
}
