#!/usr/bin/env node
/**
 * Streamable HTTP entry point for the Azure DevOps MCP Server
 */

import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { createAzureDevOpsServer } from './server';
import { getConfig } from './config';
import { createMcpRequestLogger, logMcpEvent } from './http-request-log';

const PORT = Number.parseInt(process.env.MCP_HTTP_PORT || '3000', 10);
const HOST = process.env.MCP_HTTP_HOST || '0.0.0.0';
const MCP_PATH = process.env.MCP_HTTP_PATH || '/mcp';

function isStatelessMode(): boolean {
  const value = (process.env.MCP_HTTP_STATELESS ?? 'true').toLowerCase();
  return value !== 'false' && value !== '0';
}

const STATELESS = isStatelessMode();
const transports: Record<string, StreamableHTTPServerTransport> = {};

function getSessionId(req: Request): string | undefined {
  const header = req.headers['mcp-session-id'];
  return typeof header === 'string' ? header : header?.[0];
}

async function closeMcpConnection(
  server: Server,
  transport: StreamableHTTPServerTransport,
): Promise<void> {
  await Promise.allSettled([transport.close(), server.close()]);
}

async function handleMcpPostStateless(
  req: Request,
  res: Response,
): Promise<void> {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const server = createAzureDevOpsServer(getConfig());

  const cleanup = (): Promise<void> => closeMcpConnection(server, transport);

  res.on('close', () => {
    cleanup().catch((error) => {
      logMcpEvent('error', 'MCP stateless cleanup failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logMcpEvent('error', 'MCP stateless POST request failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    await cleanup();
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

async function handleMcpPostStateful(
  req: Request,
  res: Response,
): Promise<void> {
  const sessionId = getSessionId(req);

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports[id] = transport;
          logMcpEvent('info', 'MCP session initialized', {
            sessionId: id,
            activeSessions: Object.keys(transports).length,
          });
        },
      });

      transport.onclose = () => {
        const id = transport.sessionId;
        if (id && transports[id]) {
          delete transports[id];
          logMcpEvent('info', 'MCP session closed', {
            sessionId: id,
            activeSessions: Object.keys(transports).length,
          });
        }
      };

      const server = createAzureDevOpsServer(getConfig());
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else if (sessionId) {
      res.status(404).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Session not found' },
        id: null,
      });
      return;
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: Session ID required' },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    logMcpEvent('error', 'MCP POST request failed', {
      sessionId: sessionId ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}

async function handleMcpPost(req: Request, res: Response): Promise<void> {
  if (STATELESS) {
    await handleMcpPostStateless(req, res);
    return;
  }
  await handleMcpPostStateful(req, res);
}

async function handleMcpGet(req: Request, res: Response): Promise<void> {
  if (STATELESS) {
    res
      .status(405)
      .send('SSE streams are not supported in stateless mode; use POST only');
    return;
  }

  const sessionId = getSessionId(req);

  if (!sessionId) {
    res.status(400).send('Missing session ID');
    return;
  }

  const transport = transports[sessionId];
  if (!transport) {
    res.status(404).send('Session not found');
    return;
  }

  try {
    await transport.handleRequest(req, res);
  } catch (error) {
    logMcpEvent('error', 'MCP GET request failed', {
      sessionId: sessionId ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
}

async function handleMcpDelete(req: Request, res: Response): Promise<void> {
  if (STATELESS) {
    res.status(405).send('Session termination is not used in stateless mode');
    return;
  }

  const sessionId = getSessionId(req);

  if (!sessionId) {
    res.status(400).send('Missing session ID');
    return;
  }

  const transport = transports[sessionId];
  if (!transport) {
    res.status(404).send('Session not found');
    return;
  }

  try {
    await transport.handleRequest(req, res);
  } catch (error) {
    logMcpEvent('error', 'MCP DELETE request failed', {
      sessionId: sessionId ?? null,
      error: error instanceof Error ? error.message : String(error),
    });
    if (!res.headersSent) {
      res.status(500).send('Internal server error');
    }
  }
}

async function shutdown(): Promise<void> {
  for (const sessionId of Object.keys(transports)) {
    try {
      await transports[sessionId]?.close();
      delete transports[sessionId];
    } catch (error) {
      process.stderr.write(
        `Error closing transport for session ${sessionId}: ${error}\n`,
      );
    }
  }
}

async function main(): Promise<void> {
  const app = express();

  app.set('trust proxy', true);
  app.use(cors());
  app.use(express.json({ limit: '4mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', mode: STATELESS ? 'stateless' : 'stateful' });
  });

  const mcpRequestLogger = createMcpRequestLogger(getSessionId);
  app.use(MCP_PATH, mcpRequestLogger);
  app.post(MCP_PATH, handleMcpPost);
  app.get(MCP_PATH, handleMcpGet);
  app.delete(MCP_PATH, handleMcpDelete);

  const server = app.listen(PORT, HOST, () => {
    logMcpEvent('info', 'Azure DevOps MCP HTTP server started', {
      host: HOST,
      port: PORT,
      path: MCP_PATH,
      mode: STATELESS ? 'stateless' : 'stateful',
      logLevel: process.env.LOG_LEVEL || 'info',
    });
  });

  const closeServer = (): Promise<void> =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

  const onSignal = async (signal: string): Promise<void> => {
    process.stderr.write(`Received ${signal}, shutting down...\n`);
    await shutdown();
    await closeServer();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    onSignal('SIGINT').catch((error) => {
      process.stderr.write(`Shutdown error: ${error}\n`);
      process.exit(1);
    });
  });

  process.on('SIGTERM', () => {
    onSignal('SIGTERM').catch((error) => {
      process.stderr.write(`Shutdown error: ${error}\n`);
      process.exit(1);
    });
  });
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Fatal error in main(): ${error}\n`);
    process.exit(1);
  });
}
