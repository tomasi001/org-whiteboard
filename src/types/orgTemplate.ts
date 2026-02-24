import type { WorkflowType } from "@/types";

export interface OrgTemplateAgent {
  name: string;
  description?: string;
  automations?: string[];
}

export interface OrgTemplateProcess {
  name: string;
  description?: string;
  agents?: OrgTemplateAgent[];
}

export interface OrgTemplateWorkflow {
  name: string;
  type: WorkflowType;
  description?: string;
  processes?: OrgTemplateProcess[];
}

export interface OrgTemplateTeam {
  name: string;
  description?: string;
  teamLead?: string;
  teamMembers?: string[];
  tools?: string[];
  workflows?: OrgTemplateWorkflow[];
}

export interface OrgTemplateDepartment {
  name: string;
  description?: string;
  head?: string;
  teams?: OrgTemplateTeam[];
  workflows?: OrgTemplateWorkflow[];
}

export interface OrgTemplate {
  name: string;
  description?: string;
  departments?: OrgTemplateDepartment[];
  workflows?: OrgTemplateWorkflow[];
}

