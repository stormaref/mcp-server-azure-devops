#!/usr/bin/env node
/**
 * Entry point for the Azure DevOps MCP Server
 */

import { createAzureDevOpsServer } from './server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getConfig } from './config';

export { normalizeAuthMethod, getConfig } from './config';

async function main() {
  try {
    const server = createAzureDevOpsServer(getConfig());
    const transport = new StdioServerTransport();
    await server.connect(transport);

    process.stderr.write('Azure DevOps MCP Server running on stdio\n');
  } catch (error) {
    process.stderr.write(`Error starting server: ${error}\n`);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Fatal error in main(): ${error}\n`);
    process.exit(1);
  });
}

export * from './server';
