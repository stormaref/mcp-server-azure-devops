import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import {
  isOrganizationsRequest,
  handleOrganizationsRequest,
} from './features/organizations';
import {
  isPipelinesRequest,
  handlePipelinesRequest,
} from './features/pipelines';
import { isProjectsRequest, handleProjectsRequest } from './features/projects';
import {
  isPullRequestsRequest,
  handlePullRequestsRequest,
} from './features/pull-requests';
import {
  isRepositoriesRequest,
  handleRepositoriesRequest,
} from './features/repositories';
import { isSearchRequest, handleSearchRequest } from './features/search';
import { isUsersRequest, handleUsersRequest } from './features/users';
import { isWikisRequest, handleWikisRequest } from './features/wikis';
import {
  isWorkItemsRequest,
  handleWorkItemsRequest,
} from './features/work-items';
import { getConnection } from './connection';
import { handleResponseError } from './shared/errors/handle-request-error';
import { AzureDevOpsConfig } from './shared/types';

export async function executeToolCall(
  config: AzureDevOpsConfig,
  toolName: string,
  args: Record<string, unknown> = {},
) {
  const request: CallToolRequest = {
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  };

  try {
    const connection = await getConnection(config);

    if (isWorkItemsRequest(request)) {
      return await handleWorkItemsRequest(connection, request);
    }

    if (isProjectsRequest(request)) {
      return await handleProjectsRequest(connection, request);
    }

    if (isRepositoriesRequest(request)) {
      return await handleRepositoriesRequest(connection, request);
    }

    if (isOrganizationsRequest(request)) {
      return await handleOrganizationsRequest(connection, request);
    }

    if (isSearchRequest(request)) {
      return await handleSearchRequest(connection, request);
    }

    if (isUsersRequest(request)) {
      return await handleUsersRequest(connection, request);
    }

    if (isPullRequestsRequest(request)) {
      return await handlePullRequestsRequest(connection, request);
    }

    if (isPipelinesRequest(request)) {
      return await handlePipelinesRequest(connection, request);
    }

    if (isWikisRequest(request)) {
      return await handleWikisRequest(connection, request);
    }

    throw new Error(`Unknown tool: ${toolName}`);
  } catch (error) {
    return handleResponseError(error);
  }
}
