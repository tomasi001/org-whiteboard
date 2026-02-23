import type { NodeType, WorkflowType } from "@/types";

export interface GeneratedNode {
  id: string;
  type: NodeType;
  name: string;
  description?: string;
  departmentHead?: string;
  workflowType?: WorkflowType;
  children: GeneratedNode[];
}

export interface GeneratedOrganization {
  name: string;
  description?: string;
  rootNode: GeneratedNode;
}

// Generate a unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// System prompt for generating organizational structures
const SYSTEM_PROMPT = `You are an expert organizational designer. Your task is to generate comprehensive organizational structures based on user descriptions.

You must output valid JSON that matches this exact structure:
{
  "name": "Organization Name",
  "description": "Brief description",
  "departments": [
    {
      "name": "Department Name",
      "description": "What this department does",
      "head": "Name of department head (optional)",
      "teams": [
        {
          "name": "Team Name",
          "description": "Team purpose",
          "teamLead": "Team lead name (optional)",
          "teamMembers": ["Member 1", "Member 2"],
          "tools": ["Tool 1", "Tool 2"],
          "workflows": [
            {
              "name": "Workflow Name",
              "type": "agentic or linear",
              "description": "What this workflow does",
              "processes": [
                {
                  "name": "Process Name",
                  "description": "Process description",
                  "agents": [
                    {
                      "name": "Agent Name",
                      "description": "What this agent does",
                      "automations": ["Automation 1", "Automation 2"]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ],
      "workflows": []
    }
  ],
  "workflows": []
}

Rules:
1. Be comprehensive - use all available levels: departments → teams → team members → tools → workflows → processes → agents → automations
2. Be realistic - generate plausible names, roles, and descriptions based on the organization type
3. Include 3-6 departments for most organizations
4. Each department should have 2-4 teams
5. Include relevant tools (e.g., "ClickUp", "Gmail", "Slack", "Salesforce", "HubSpot")
6. Mark workflows as "agentic" for AI-driven processes, "linear" for sequential processes
7. Include automations where appropriate (e.g., "Auto-assign leads", "Send weekly reports")

Output ONLY valid JSON, no markdown formatting or explanations.`;

export async function generateOrganization(userPrompt: string): Promise<GeneratedOrganization> {
  // Since we can't call external APIs directly, we'll use a local generation approach
  // In production, this would call an LLM API
  
  const lowercasePrompt = userPrompt.toLowerCase();
  
  // Detect organization type from prompt
  const isTech = lowercasePrompt.includes('tech') || lowercasePrompt.includes('software') || lowercasePrompt.includes('startup');
  const isHealthcare = lowercasePrompt.includes('health') || lowercasePrompt.includes('hospital') || lowercasePrompt.includes('medical');
  const isFinance = lowercasePrompt.includes('finance') || lowercasePrompt.includes('bank') || lowercasePrompt.includes('investment');
  const isRetail = lowercasePrompt.includes('retail') || lowercasePrompt.includes('shop') || lowercasePrompt.includes('store');
  const isManufacturing = lowercasePrompt.includes('manufacturing') || lowercasePrompt.includes('factory') || lowercasePrompt.includes('production');
  
  // Extract organization name if provided
  const nameMatch = userPrompt.match(/(?:called|named|for)\s+["']?([A-Z][a-zA-Z\s]+?)["']?(?:\s|$|,|\.)/i);
  const orgName = nameMatch ? nameMatch[1].trim() : "Organization";

  if (isTech) {
    return generateTechCompany(orgName, userPrompt);
  } else if (isHealthcare) {
    return generateHealthcareOrg(orgName, userPrompt);
  } else if (isFinance) {
    return generateFinanceOrg(orgName, userPrompt);
  } else if (isRetail) {
    return generateRetailOrg(orgName, userPrompt);
  } else if (isManufacturing) {
    return generateManufacturingOrg(orgName, userPrompt);
  }
  
  // Default generic organization
  return generateGenericOrg(orgName, userPrompt);
}

function generateTechCompany(name: string, prompt: string): GeneratedOrganization {
  const departments = [
    {
      name: "Engineering",
      description: "Software development and technical infrastructure",
      head: "VP of Engineering",
      teams: [
        {
          name: "Frontend Team",
          description: "User interface and experience development",
          teamLead: "Senior Frontend Lead",
          teamMembers: ["UI Developer", "UX Engineer", "React Specialist"],
          tools: ["Figma", "React", "TypeScript", "Storybook"],
          workflows: [
            { name: "Feature Development", type: "agentic" as WorkflowType, description: "Develop new UI features with AI assistance" }
          ]
        },
        {
          name: "Backend Team",
          description: "Server-side logic and APIs",
          teamLead: "Backend Lead",
          teamMembers: ["API Developer", "Database Engineer", "DevOps Engineer"],
          tools: ["Node.js", "PostgreSQL", "Docker", "AWS"],
          workflows: [
            { name: "API Deployment", type: "linear" as WorkflowType, description: "Deploy and monitor API services" }
          ]
        }
      ],
      workflows: []
    },
    {
      name: "Product",
      description: "Product strategy and management",
      head: "Chief Product Officer",
      teams: [
        {
          name: "Product Management",
          description: "Product roadmap and feature prioritization",
          teamLead: "Senior PM",
          teamMembers: ["Product Manager", "Business Analyst"],
          tools: ["Jira", "Confluence", "Amplitude", "Miro"],
          workflows: [
            { name: "Roadmap Planning", type: "linear" as WorkflowType, description: "Quarterly roadmap development" }
          ]
        }
      ],
      workflows: []
    },
    {
      name: "Sales",
      description: "Revenue generation and client relationships",
      head: "VP of Sales",
      teams: [
        {
          name: "Enterprise Sales",
          description: "Large account acquisition",
          teamLead: "Enterprise Sales Director",
          teamMembers: ["Account Executive", "Solutions Engineer"],
          tools: ["Salesforce", "LinkedIn Sales Navigator", "Gong"],
          workflows: [
            { name: "Lead Qualification", type: "agentic" as WorkflowType, description: "AI-powered lead scoring and qualification" }
          ]
        }
      ],
      workflows: []
    },
    {
      name: "Marketing",
      description: "Brand and demand generation",
      head: "CMO",
      teams: [
        {
          name: "Digital Marketing",
          description: "Online presence and campaigns",
          teamLead: "Digital Marketing Manager",
          teamMembers: ["Content Writer", "SEO Specialist", "Social Media Manager"],
          tools: ["HubSpot", "Google Analytics", "Mailchimp", "Canva"],
          workflows: [
            { name: "Content Pipeline", type: "linear" as WorkflowType, description: "Content creation and distribution workflow" }
          ]
        }
      ],
      workflows: []
    }
  ];

  return buildOrgStructure(name, "Technology company focused on innovation", departments);
}

function generateHealthcareOrg(name: string, prompt: string): GeneratedOrganization {
  const departments = [
    {
      name: "Clinical Services",
      description: "Patient care and medical services",
      head: "Chief Medical Officer",
      teams: [
        {
          name: "Emergency Department",
          description: "Emergency and urgent care",
          teamLead: "Emergency Department Director",
          teamMembers: ["Emergency Physician", "Trauma Nurse", "EMT"],
          tools: ["Epic EHR", "Philips Monitor", "CareAware"],
          workflows: [{ name: "Patient Triage", type: "linear" as WorkflowType, description: "Emergency patient assessment and routing" }]
        },
        {
          name: "Surgery",
          description: "Surgical procedures and operations",
          teamLead: "Chief of Surgery",
          teamMembers: ["Surgeon", "Anesthesiologist", "Surgical Nurse"],
          tools: ["Cerner", "Surgical Robot", "OR Manager"],
          workflows: [{ name: "Pre-op Assessment", type: "linear" as WorkflowType, description: "Pre-surgical patient preparation" }]
        }
      ],
      workflows: []
    },
    {
      name: "Nursing",
      description: "Patient care coordination",
      head: "Chief Nursing Officer",
      teams: [
        {
          name: "Inpatient Care",
          description: "Hospital ward nursing",
          teamLead: "Nurse Manager",
          teamMembers: ["Registered Nurse", "Nurse Practitioner", "Nursing Assistant"],
          tools: ["Epic Care", "Pyxis", "Vocera"],
          workflows: [{ name: "Patient Handoff", type: "linear" as WorkflowType, description: "Shift change patient handover" }]
        }
      ],
      workflows: []
    },
    {
      name: "Administration",
      description: "Hospital operations and management",
      head: "Hospital Administrator",
      teams: [
        {
          name: "Patient Services",
          description: "Patient registration and billing",
          teamLead: "Patient Services Director",
          teamMembers: ["Registration Clerk", "Billing Specialist", "Insurance Coordinator"],
          tools: ["Epic Registration", "RCM System", "Patient Portal"],
          workflows: [{ name: "Insurance Verification", type: "agentic" as WorkflowType, description: "Automated insurance checking" }]
        }
      ],
      workflows: []
    }
  ];

  return buildOrgStructure(name, "Healthcare organization providing medical services", departments);
}

function generateFinanceOrg(name: string, prompt: string): GeneratedOrganization {
  const departments = [
    {
      name: "Investment Banking",
      description: "M&A and capital markets advisory",
      head: "Head of Investment Banking",
      teams: [
        {
          name: "M&A Advisory",
          description: "Merger and acquisition transactions",
          teamLead: "M&A Director",
          teamMembers: ["VP - M&A", "Associate", "Analyst"],
          tools: ["Bloomberg", "Capital IQ", "DealCloud"],
          workflows: [{ name: "Deal Pipeline", type: "linear" as WorkflowType, description: "Track and manage M&A opportunities" }]
        }
      ],
      workflows: []
    },
    {
      name: "Asset Management",
      description: "Portfolio management and investments",
      head: "Chief Investment Officer",
      teams: [
        {
          name: "Portfolio Management",
          description: "Investment strategy and execution",
          teamLead: "Senior Portfolio Manager",
          teamMembers: ["Portfolio Manager", "Research Analyst", "Risk Analyst"],
          tools: ["Bloomberg Terminal", "FactSet", "BlackRock Aladdin"],
          workflows: [{ name: "Rebalancing", type: "agentic" as WorkflowType, description: "AI-assisted portfolio rebalancing" }]
        }
      ],
      workflows: []
    },
    {
      name: "Risk Management",
      description: "Enterprise and financial risk",
      head: "Chief Risk Officer",
      teams: [
        {
          name: "Credit Risk",
          description: "Credit assessment and monitoring",
          teamLead: "Head of Credit Risk",
          teamMembers: ["Credit Analyst", "Risk Modeler", "Compliance Officer"],
          tools: ["SAS Risk", "Moody's Analytics", "FICO"],
          workflows: [{ name: "Credit Scoring", type: "agentic" as WorkflowType, description: "Automated credit risk assessment" }]
        }
      ],
      workflows: []
    }
  ];

  return buildOrgStructure(name, "Financial services organization", departments);
}

function generateRetailOrg(name: string, prompt: string): GeneratedOrganization {
  const departments = [
    {
      name: "Store Operations",
      description: "Retail store management",
      head: "VP of Store Operations",
      teams: [
        {
          name: "Store Management",
          description: "Individual store operations",
          teamLead: "Store Manager",
          teamMembers: ["Assistant Manager", "Department Lead", "Sales Associate"],
          tools: ["POS System", "Inventory Management", "Scheduling Software"],
          workflows: [{ name: "Daily Opening", type: "linear" as WorkflowType, description: "Store opening procedures" }]
        }
      ],
      workflows: []
    },
    {
      name: "Merchandising",
      description: "Product selection and pricing",
      head: "Chief Merchandising Officer",
      teams: [
        {
          name: "Buying Team",
          description: "Product selection and vendor relations",
          teamLead: "Senior Buyer",
          teamMembers: ["Buyer", "Merchandise Planner", "Vendor Manager"],
          tools: ["Planning Software", "Assortment Tool", "Vendor Portal"],
          workflows: [{ name: "Season Planning", type: "linear" as WorkflowType, description: "Seasonal product planning" }]
        }
      ],
      workflows: []
    },
    {
      name: "E-commerce",
      description: "Online sales channel",
      head: "Head of E-commerce",
      teams: [
        {
          name: "Digital Operations",
          description: "Website and online sales",
          teamLead: "E-commerce Manager",
          teamMembers: ["Web Developer", "Digital Marketing Specialist", "Customer Service Rep"],
          tools: ["Shopify", "Google Analytics", "Klaviyo"],
          workflows: [{ name: "Order Fulfillment", type: "linear" as WorkflowType, description: "Online order processing" }]
        }
      ],
      workflows: []
    }
  ];

  return buildOrgStructure(name, "Retail organization", departments);
}

function generateManufacturingOrg(name: string, prompt: string): GeneratedOrganization {
  const departments = [
    {
      name: "Production",
      description: "Manufacturing and assembly",
      head: "VP of Manufacturing",
      teams: [
        {
          name: "Assembly Line",
          description: "Product assembly operations",
          teamLead: "Production Supervisor",
          teamMembers: ["Assembly Technician", "Quality Inspector", "Machine Operator"],
          tools: ["MES System", "Quality Management", "IoT Sensors"],
          workflows: [{ name: "Production Scheduling", type: "linear" as WorkflowType, description: "Daily production planning" }]
        }
      ],
      workflows: []
    },
    {
      name: "Supply Chain",
      description: "Procurement and logistics",
      head: "Chief Supply Chain Officer",
      teams: [
        {
          name: "Procurement",
          description: "Raw material sourcing",
          teamLead: "Procurement Manager",
          teamMembers: ["Buyer", "Supplier Relations", "Contract Manager"],
          tools: ["SAP", "Coupa", "Supplier Portal"],
          workflows: [{ name: "Purchase Order", type: "linear" as WorkflowType, description: "Procurement request and approval" }]
        }
      ],
      workflows: []
    },
    {
      name: "Quality Assurance",
      description: "Product quality and compliance",
      head: "Quality Director",
      teams: [
        {
          name: "Quality Control",
          description: "Product testing and inspection",
          teamLead: "QC Manager",
          teamMembers: ["Quality Engineer", "Lab Technician", "Compliance Specialist"],
          tools: ["QMS Software", "Statistical Tools", "Calibration System"],
          workflows: [{ name: "Inspection Process", type: "linear" as WorkflowType, description: "Product quality verification" }]
        }
      ],
      workflows: []
    }
  ];

  return buildOrgStructure(name, "Manufacturing organization", departments);
}

function generateGenericOrg(name: string, prompt: string): GeneratedOrganization {
  const departments = [
    {
      name: "Operations",
      description: "Core business operations",
      head: "COO",
      teams: [
        {
          name: "Operations Team",
          description: "Day-to-day operations",
          teamLead: "Operations Manager",
          teamMembers: ["Operations Specialist", "Coordinator", "Analyst"],
          tools: ["Project Management", "Communication Tool", "Documentation"],
          workflows: [{ name: "Daily Operations", type: "linear" as WorkflowType, description: "Standard operating procedures" }]
        }
      ],
      workflows: []
    },
    {
      name: "Human Resources",
      description: "People and culture",
      head: "CHRO",
      teams: [
        {
          name: "Talent Acquisition",
          description: "Recruiting and hiring",
          teamLead: "Recruiting Manager",
          teamMembers: ["Recruiter", "HR Coordinator", "Onboarding Specialist"],
          tools: ["ATS", "LinkedIn", "HRIS"],
          workflows: [{ name: "Hiring Process", type: "linear" as WorkflowType, description: "End-to-end recruitment workflow" }]
        }
      ],
      workflows: []
    },
    {
      name: "Finance",
      description: "Financial management",
      head: "CFO",
      teams: [
        {
          name: "Accounting",
          description: "Financial reporting and accounting",
          teamLead: "Controller",
          teamMembers: ["Accountant", "Financial Analyst", "AP/AR Specialist"],
          tools: ["QuickBooks", "Excel", "Expense Management"],
          workflows: [{ name: "Month-end Close", type: "linear" as WorkflowType, description: "Monthly financial closing process" }]
        }
      ],
      workflows: []
    }
  ];

  return buildOrgStructure(name, "General business organization", departments);
}

function buildOrgStructure(name: string, description: string, departments: any[]): GeneratedOrganization {
  const rootNode: GeneratedNode = {
    id: generateId(),
    type: "organisation",
    name,
    description,
    children: departments.map(dept => ({
      id: generateId(),
      type: "department" as NodeType,
      name: dept.name,
      description: dept.description,
      departmentHead: dept.head,
      children: [
        ...(dept.teams?.map((team: any) => ({
          id: generateId(),
          type: "team" as NodeType,
          name: team.name,
          description: team.description,
          children: [
            ...(team.teamLead ? [{
              id: generateId(),
              type: "teamLead" as NodeType,
              name: team.teamLead,
              children: []
            }] : []),
            ...(team.teamMembers?.map((member: string) => ({
              id: generateId(),
              type: "teamMember" as NodeType,
              name: member,
              children: []
            })) || []),
            ...(team.tools?.map((tool: string) => ({
              id: generateId(),
              type: "tool" as NodeType,
              name: tool,
              children: []
            })) || []),
            ...(team.workflows?.map((wf: any) => ({
              id: generateId(),
              type: "workflow" as NodeType,
              name: wf.name,
              workflowType: wf.type,
              description: wf.description,
              children: wf.processes?.map((proc: any) => ({
                id: generateId(),
                type: "process" as NodeType,
                name: proc.name,
                description: proc.description,
                children: proc.agents?.map((agent: any) => ({
                  id: generateId(),
                  type: "agent" as NodeType,
                  name: agent.name,
                  description: agent.description,
                  children: agent.automations?.map((auto: string) => ({
                    id: generateId(),
                    type: "automation" as NodeType,
                    name: auto,
                    children: []
                  })) || []
                })) || []
              })) || []
            })) || [])
          ]
        })) || []),
        ...(dept.workflows?.map((wf: any) => ({
          id: generateId(),
          type: "workflow" as NodeType,
          name: wf.name,
          workflowType: wf.type,
          children: []
        })) || [])
      ]
    }))
  };

  return { name, description, rootNode };
}