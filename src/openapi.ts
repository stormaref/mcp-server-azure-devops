import { VERSION } from './shared/config';
import { ToolDefinition } from './shared/types/tool-definition';
import { getAllTools } from './tools-registry';

type OpenApiDocument = {
  openapi: string;
  info: {
    title: string;
    description: string;
    version: string;
  };
  paths: Record<string, unknown>;
};

function asObjectSchema(
  inputSchema: ToolDefinition['inputSchema'],
): Record<string, unknown> {
  if (
    inputSchema &&
    typeof inputSchema === 'object' &&
    !Array.isArray(inputSchema)
  ) {
    return inputSchema as Record<string, unknown>;
  }

  return { type: 'object', properties: {} };
}

export function buildOpenApiDocument(
  tools: ToolDefinition[] = getAllTools(),
): OpenApiDocument {
  const paths: Record<string, unknown> = {};

  for (const tool of tools) {
    const schema = asObjectSchema(tool.inputSchema);
    const hasRequiredProperties =
      Array.isArray(schema.required) && schema.required.length > 0;

    paths[`/${tool.name}`] = {
      post: {
        operationId: tool.name,
        summary: tool.description,
        description: tool.description,
        requestBody: {
          required: hasRequiredProperties,
          content: {
            'application/json': {
              schema,
            },
          },
        },
        responses: {
          '200': {
            description: 'Tool execution result',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Azure DevOps MCP Server',
      description:
        'OpenAPI surface for Azure DevOps MCP tools. Compatible with Open WebUI OpenAPI tool servers.',
      version: VERSION,
    },
    paths,
  };
}
