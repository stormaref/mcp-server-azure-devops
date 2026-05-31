import dotenv from 'dotenv';
import { AzureDevOpsConfig } from './shared/types';
import { AuthenticationMethod } from './shared/auth/auth-factory';

dotenv.config();

/**
 * Normalize auth method string to a valid AuthenticationMethod enum value
 * in a case-insensitive manner
 */
export function normalizeAuthMethod(
  authMethodStr?: string,
): AuthenticationMethod {
  if (!authMethodStr) {
    return AuthenticationMethod.AzureIdentity;
  }

  const normalizedMethod = authMethodStr.toLowerCase();

  if (
    normalizedMethod === AuthenticationMethod.PersonalAccessToken.toLowerCase()
  ) {
    return AuthenticationMethod.PersonalAccessToken;
  }

  if (normalizedMethod === AuthenticationMethod.AzureIdentity.toLowerCase()) {
    return AuthenticationMethod.AzureIdentity;
  }

  if (normalizedMethod === AuthenticationMethod.AzureCli.toLowerCase()) {
    return AuthenticationMethod.AzureCli;
  }

  process.stderr.write(
    `WARNING: Unrecognized auth method '${authMethodStr}'. Using default (${AuthenticationMethod.AzureIdentity}).\n`,
  );
  return AuthenticationMethod.AzureIdentity;
}

export function getConfig(): AzureDevOpsConfig {
  process.stderr.write(`DEBUG - Environment variables in getConfig():
  AZURE_DEVOPS_ORG_URL: ${process.env.AZURE_DEVOPS_ORG_URL || 'NOT SET'}
  AZURE_DEVOPS_AUTH_METHOD: ${process.env.AZURE_DEVOPS_AUTH_METHOD || 'NOT SET'}
  AZURE_DEVOPS_PAT: ${process.env.AZURE_DEVOPS_PAT ? 'SET (hidden)' : 'NOT SET'}
  AZURE_DEVOPS_DEFAULT_PROJECT: ${process.env.AZURE_DEVOPS_DEFAULT_PROJECT || 'NOT SET'}
  AZURE_DEVOPS_API_VERSION: ${process.env.AZURE_DEVOPS_API_VERSION || 'NOT SET'}
  NODE_ENV: ${process.env.NODE_ENV || 'NOT SET'}
\n`);

  return {
    organizationUrl: process.env.AZURE_DEVOPS_ORG_URL || '',
    authMethod: normalizeAuthMethod(process.env.AZURE_DEVOPS_AUTH_METHOD),
    personalAccessToken: process.env.AZURE_DEVOPS_PAT,
    defaultProject: process.env.AZURE_DEVOPS_DEFAULT_PROJECT,
    apiVersion: process.env.AZURE_DEVOPS_API_VERSION,
  };
}
