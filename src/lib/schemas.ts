import { z } from "zod";
import type { NodeType } from "@/types";

const nodeTypeValues = [
  "organisation",
  "department",
  "team",
  "agentSwarm",
  "teamLead",
  "teamMember",
  "agentLead",
  "agentMember",
  "role",
  "subRole",
  "tool",
  "workflow",
  "process",
  "agent",
  "automation",
] as const;

const nonEmptyString = z.string().trim().min(1);
const nodeTypeSchema = z.enum(nodeTypeValues);

export const workflowTypeSchema = z.enum(["agentic", "linear"]);

export const orgTemplateAgentSchema = z.object({
  name: nonEmptyString,
  description: z.string().trim().optional(),
  automations: z.array(nonEmptyString).optional(),
});

export const orgTemplateProcessSchema = z.object({
  name: nonEmptyString,
  description: z.string().trim().optional(),
  agents: z.array(orgTemplateAgentSchema).optional(),
});

export const orgTemplateWorkflowSchema = z.object({
  name: nonEmptyString,
  type: workflowTypeSchema,
  description: z.string().trim().optional(),
  processes: z.array(orgTemplateProcessSchema).optional(),
});

export const orgTemplateTeamSchema = z.object({
  name: nonEmptyString,
  description: z.string().trim().optional(),
  teamLead: z.string().trim().optional(),
  teamMembers: z.array(nonEmptyString).optional(),
  tools: z.array(nonEmptyString).optional(),
  workflows: z.array(orgTemplateWorkflowSchema).optional(),
});

export const orgTemplateDepartmentSchema = z.object({
  name: nonEmptyString,
  description: z.string().trim().optional(),
  head: z.string().trim().optional(),
  teams: z.array(orgTemplateTeamSchema).optional(),
  workflows: z.array(orgTemplateWorkflowSchema).optional(),
});

export const orgTemplateSchema = z.object({
  name: nonEmptyString,
  description: z.string().trim().optional(),
  departments: z.array(orgTemplateDepartmentSchema).optional(),
  workflows: z.array(orgTemplateWorkflowSchema).optional(),
});

export const orgIntakeStateSchema = z.object({
  name: z.string().trim().optional(),
  description: z.string().trim().optional(),
  industry: z.string().trim().optional(),
  goals: z.array(nonEmptyString).optional(),
  constraints: z.array(nonEmptyString).optional(),
  departments: z.array(orgTemplateDepartmentSchema).optional(),
  workflows: z.array(orgTemplateWorkflowSchema).optional(),
});

const conversationHistoryMessageSchema = z.object({
  role: z.enum(["assistant", "user"]),
  content: nonEmptyString.max(8_000),
});

export const conversationResponseSchema = z.object({
  guidance: nonEmptyString,
  state: orgIntakeStateSchema,
  previewData: orgTemplateSchema.nullable().optional(),
  missingFields: z.array(nonEmptyString).default([]),
  suggestions: z.array(nonEmptyString).optional(),
  readyToGenerate: z.boolean().optional(),
});

export const orgBuilderOnboardingSchema = z.object({
  companyName: nonEmptyString.max(200),
  companyDescription: nonEmptyString.max(10_000),
});

export const orgBuilderRequestSchema = z
  .object({
    mode: z.enum(["initial", "revision"]),
    onboarding: orgBuilderOnboardingSchema.optional(),
    currentDraft: orgTemplateSchema.nullable().optional(),
    feedback: z.string().trim().max(10_000).optional(),
  })
  .superRefine((value, context) => {
    if (value.mode === "initial" && !value.onboarding) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["onboarding"],
        message: "onboarding is required for initial mode.",
      });
    }

    if (value.mode === "revision") {
      if (!value.currentDraft) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["currentDraft"],
          message: "currentDraft is required for revision mode.",
        });
      }

      if (!value.feedback || value.feedback.trim().length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["feedback"],
          message: "feedback is required for revision mode.",
        });
      }
    }
  });

export const orgBuilderResponseSchema = z.object({
  guidance: nonEmptyString,
  updatedDraft: orgTemplateSchema,
  questions: z.array(nonEmptyString).default([]),
  isValidForProceed: z.boolean(),
});

export const generateRequestSchema = z.object({
  prompt: nonEmptyString.max(50_000),
  mode: z.enum(["generate", "conversation"]).optional(),
  orgData: z.record(z.string(), z.unknown()).optional(),
  state: orgIntakeStateSchema.optional(),
  source: z.enum(["message", "json", "document"]).optional(),
  structuredJson: z.string().trim().max(200_000).optional(),
  conversationHistory: z.array(conversationHistoryMessageSchema).max(24).optional(),
  currentStep: z.string().trim().optional(),
});

type WhiteboardNodeSnapshot = {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  children: WhiteboardNodeSnapshot[];
};

const whiteboardNodeSnapshotSchema: z.ZodType<WhiteboardNodeSnapshot> = z.lazy(() =>
  z.object({
    id: nonEmptyString,
    type: nodeTypeSchema,
    name: nonEmptyString,
    description: z.string().trim().optional(),
    children: z.array(whiteboardNodeSnapshotSchema),
  })
);

export const whiteboardSnapshotSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  rootNode: whiteboardNodeSnapshotSchema,
});

export const chatActionSchema = z.object({
  action: z.enum(["add", "remove", "update", "none"]),
  targetId: z.string().trim().optional(),
  targetName: z.string().trim().optional(),
  reply: nonEmptyString,
  data: z
    .object({
      type: nodeTypeSchema.optional(),
      name: z.string().trim().optional(),
      description: z.string().trim().optional(),
      workflowType: workflowTypeSchema.optional(),
    })
    .optional(),
});

export const chatRequestSchema = z.object({
  message: nonEmptyString.max(4000),
  currentWhiteboard: whiteboardSnapshotSchema.nullable(),
  selectedNodeId: z.string().trim().optional(),
});

export type OrgTemplateSchema = z.infer<typeof orgTemplateSchema>;
export type ConversationResponse = z.infer<typeof conversationResponseSchema>;
export type OrgBuilderRequest = z.infer<typeof orgBuilderRequestSchema>;
export type OrgBuilderResponse = z.infer<typeof orgBuilderResponseSchema>;
export type ChatAction = z.infer<typeof chatActionSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;
