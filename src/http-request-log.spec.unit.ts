import { createMcpRequestLogger } from './http-request-log';

describe('http-request-log', () => {
  it('should log MCP POST requests with JSON-RPC summary', () => {
    // Arrange
    const stderrWrite = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    const logger = createMcpRequestLogger(() => 'session-123');
    const req = {
      method: 'POST',
      path: '/mcp',
      originalUrl: '/azure/mcp',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-client',
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'list_projects', arguments: {} },
      },
    } as never;
    const res = {
      statusCode: 200,
      getHeader: jest.fn(),
      on: jest.fn((event: string, handler: () => void) => {
        if (event === 'finish') {
          handler();
        }
      }),
    } as never;
    const next = jest.fn();

    // Act
    logger(req, res, next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalled();
    const logOutput = stderrWrite.mock.calls
      .map((call) => String(call[0]))
      .join('\n');
    expect(logOutput).toContain('MCP request received');
    expect(logOutput).toContain('tools/call');
    expect(logOutput).toContain('list_projects');
    expect(logOutput).toContain('MCP request completed');

    stderrWrite.mockRestore();
  });
});
