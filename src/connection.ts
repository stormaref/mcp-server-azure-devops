import { WebApi } from 'azure-devops-node-api';
import { AuthenticationMethod, AzureDevOpsClient } from './shared/auth';
import { AzureDevOpsAuthenticationError } from './shared/errors';
import { AzureDevOpsConfig } from './shared/types';

export async function getConnection(
  config: AzureDevOpsConfig,
): Promise<WebApi> {
  try {
    const client = new AzureDevOpsClient({
      method: config.authMethod || AuthenticationMethod.AzureIdentity,
      organizationUrl: config.organizationUrl,
      personalAccessToken: config.personalAccessToken,
    });

    await client.getCoreApi();
    return await client.getWebApiClient();
  } catch (error) {
    throw new AzureDevOpsAuthenticationError(
      `Failed to connect to Azure DevOps: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
