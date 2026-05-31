import { organizationsTools } from './features/organizations/tool-definitions';
import { pipelinesTools } from './features/pipelines/tool-definitions';
import { projectsTools } from './features/projects/tool-definitions';
import { pullRequestsTools } from './features/pull-requests/tool-definitions';
import { repositoriesTools } from './features/repositories/tool-definitions';
import { searchTools } from './features/search/tool-definitions';
import { usersTools } from './features/users/tool-definitions';
import { wikisTools } from './features/wikis/tool-definitions';
import { workItemsTools } from './features/work-items/tool-definitions';
import { ToolDefinition } from './shared/types/tool-definition';

const allTools: ToolDefinition[] = [
  ...usersTools,
  ...organizationsTools,
  ...projectsTools,
  ...repositoriesTools,
  ...workItemsTools,
  ...searchTools,
  ...pullRequestsTools,
  ...pipelinesTools,
  ...wikisTools,
];

export function getAllTools(): ToolDefinition[] {
  return allTools.filter((tool) => tool.mcp_enabled !== false);
}

export function getToolByName(name: string): ToolDefinition | undefined {
  return getAllTools().find((tool) => tool.name === name);
}
