import { buildOpenApiDocument } from './openapi';
import { getAllTools } from './tools-registry';

describe('openapi', () => {
  it('should expose each MCP tool as a POST operation with operationId', () => {
    const document = buildOpenApiDocument();
    const tools = getAllTools();

    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.paths)).toHaveLength(tools.length);

    for (const tool of tools) {
      const operation = (
        document.paths[`/${tool.name}`] as {
          post?: { operationId?: string };
        }
      )?.post;

      expect(operation?.operationId).toBe(tool.name);
    }
  });
});
