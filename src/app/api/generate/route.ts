import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are an expert organizational designer AI that thinks deeply about organizational structures. Your task is to generate comprehensive, realistic organizational structures based on user descriptions.

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

Think carefully about:
1. The type of organization (tech, healthcare, finance, retail, manufacturing, etc.)
2. The realistic size and complexity based on the description
3. Modern tools and systems that organization would use
4. Whether workflows should be agentic (AI-driven) or linear (sequential) based on the task
5. Realistic job titles and roles
6. Practical automations that make sense

Be comprehensive - use all available levels: departments → teams → team members → tools → workflows → processes → agents → automations

Output ONLY valid JSON, no markdown formatting or explanations.`;

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      // Fallback to mock response for development
      return NextResponse.json(generateMockResponse(prompt));
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Generate an organizational structure for: ${prompt}` }
        ],
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      return NextResponse.json(generateMockResponse(prompt));
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(generateMockResponse(prompt));
    }

    try {
      const parsed = JSON.parse(content);
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json(generateMockResponse(prompt));
    }
  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json({ error: 'Failed to generate organization' }, { status: 500 });
  }
}

function generateMockResponse(prompt: string) {
  const lowerPrompt = prompt.toLowerCase();
  
  let orgType = 'generic';
  if (lowerPrompt.includes('tech') || lowerPrompt.includes('software') || lowerPrompt.includes('startup')) {
    orgType = 'tech';
  } else if (lowerPrompt.includes('health') || lowerPrompt.includes('hospital') || lowerPrompt.includes('medical')) {
    orgType = 'healthcare';
  } else if (lowerPrompt.includes('finance') || lowerPrompt.includes('bank') || lowerPrompt.includes('investment')) {
    orgType = 'finance';
  } else if (lowerPrompt.includes('retail') || lowerPrompt.includes('shop') || lowerPrompt.includes('store')) {
    orgType = 'retail';
  } else if (lowerPrompt.includes('manufacturing') || lowerPrompt.includes('factory')) {
    orgType = 'manufacturing';
  }

  // Extract name from prompt
  const nameMatch = prompt.match(/(?:called|named|for)\s+["']?([A-Z][a-zA-Z\s]+?)["']?(?:\s|$|,|\.)/i);
  const orgName = nameMatch ? nameMatch[1].trim() : "My Organization";

  const templates: Record<string, any> = {
    tech: {
      name: orgName,
      description: "Technology company focused on innovation and product development",
      departments: [
        {
          name: "Engineering",
          description: "Software development and technical infrastructure",
          head: "VP of Engineering",
          teams: [
            {
              name: "Frontend Team",
              description: "User interface and experience development",
              teamLead: "Senior Frontend Lead",
              teamMembers: ["UI Developer", "UX Engineer", "React Specialist", "Design System Engineer"],
              tools: ["Figma", "React", "TypeScript", "Storybook", "Tailwind CSS"],
              workflows: [
                { name: "Feature Development", type: "agentic", description: "Develop new UI features with AI assistance", processes: [
                  { name: "Design Review", description: "Review and approve UI designs", agents: [
                    { name: "Design Reviewer Agent", description: "AI agent that reviews UI consistency", automations: ["Auto-check design tokens", "Validate accessibility"] }
                  ]}
                ]}
              ]
            },
            {
              name: "Backend Team",
              description: "Server-side logic and APIs",
              teamLead: "Backend Lead",
              teamMembers: ["API Developer", "Database Engineer", "DevOps Engineer", "Security Engineer"],
              tools: ["Node.js", "PostgreSQL", "Docker", "AWS", "Kubernetes"],
              workflows: [
                { name: "API Deployment", type: "linear", description: "Deploy and monitor API services", processes: [
                  { name: "CI/CD Pipeline", description: "Automated deployment pipeline", agents: [
                    { name: "Deployment Agent", description: "Manages automated deployments", automations: ["Run tests", "Deploy to staging", "Deploy to production"] }
                  ]}
                ]}
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
              teamMembers: ["Product Manager", "Business Analyst", "UX Researcher"],
              tools: ["Jira", "Confluence", "Amplitude", "Miro", "Notion"],
              workflows: [
                { name: "Roadmap Planning", type: "linear", description: "Quarterly roadmap development", processes: [] }
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
              teamMembers: ["Account Executive", "Solutions Engineer", "Sales Development Rep"],
              tools: ["Salesforce", "LinkedIn Sales Navigator", "Gong", "Outreach"],
              workflows: [
                { name: "Lead Qualification", type: "agentic", description: "AI-powered lead scoring and qualification", processes: [
                  { name: "Lead Scoring", description: "Score and prioritize leads", agents: [
                    { name: "Lead Scoring Agent", description: "AI that scores leads based on behavior", automations: ["Enrich lead data", "Calculate lead score", "Route to sales rep"] }
                  ]}
                ]}
              ]
            }
          ],
          workflows: []
        }
      ],
      workflows: []
    },
    healthcare: {
      name: orgName,
      description: "Healthcare organization providing medical services",
      departments: [
        {
          name: "Clinical Services",
          description: "Patient care and medical services",
          head: "Chief Medical Officer",
          teams: [
            {
              name: "Emergency Department",
              description: "Emergency and urgent care",
              teamLead: "Emergency Department Director",
              teamMembers: ["Emergency Physician", "Trauma Nurse", "EMT", "Charge Nurse"],
              tools: ["Epic EHR", "Philips Monitor", "CareAware", "TigerConnect"],
              workflows: [
                { name: "Patient Triage", type: "linear", description: "Emergency patient assessment and routing", processes: [] }
              ]
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
              teamMembers: ["Registered Nurse", "Nurse Practitioner", "Nursing Assistant", "Care Coordinator"],
              tools: ["Epic Care", "Pyxis", "Vocera", "Alaris"],
              workflows: [
                { name: "Patient Handoff", type: "linear", description: "Shift change patient handover", processes: [] }
              ]
            }
          ],
          workflows: []
        }
      ],
      workflows: []
    },
    finance: {
      name: orgName,
      description: "Financial services organization",
      departments: [
        {
          name: "Investment Banking",
          description: "M&A and capital markets advisory",
          head: "Head of Investment Banking",
          teams: [
            {
              name: "M&A Advisory",
              description: "Merger and acquisition transactions",
              teamLead: "M&A Director",
              teamMembers: ["VP - M&A", "Associate", "Analyst", "Intern"],
              tools: ["Bloomberg", "Capital IQ", "DealCloud", "FactSet"],
              workflows: [
                { name: "Deal Pipeline", type: "linear", description: "Track and manage M&A opportunities", processes: [] }
              ]
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
              teamMembers: ["Portfolio Manager", "Research Analyst", "Risk Analyst", "Quant Analyst"],
              tools: ["Bloomberg Terminal", "FactSet", "BlackRock Aladdin", "Wind"],
              workflows: [
                { name: "Rebalancing", type: "agentic", description: "AI-assisted portfolio rebalancing", processes: [
                  { name: "Auto Rebalance", description: "Automated portfolio adjustments", agents: [
                    { name: "Rebalancing Agent", description: "AI that monitors and rebalances portfolios", automations: ["Monitor drift", "Generate trade suggestions", "Execute trades"] }
                  ]}
                ]}
              ]
            }
          ],
          workflows: []
        }
      ],
      workflows: []
    },
    retail: {
      name: orgName,
      description: "Retail organization with stores and e-commerce",
      departments: [
        {
          name: "Store Operations",
          description: "Retail store management",
          head: "VP of Store Operations",
          teams: [
            {
              name: "Store Management",
              description: "Individual store operations",
              teamLead: "Store Manager",
              teamMembers: ["Assistant Manager", "Department Lead", "Sales Associate", "Cashier"],
              tools: ["POS System", "Inventory Management", "Scheduling Software", "Handheld Scanner"],
              workflows: [
                { name: "Daily Opening", type: "linear", description: "Store opening procedures", processes: [] }
              ]
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
              teamMembers: ["Web Developer", "Digital Marketing Specialist", "Customer Service Rep", "Content Manager"],
              tools: ["Shopify", "Google Analytics", "Klaviyo", "Zendesk"],
              workflows: [
                { name: "Order Fulfillment", type: "linear", description: "Online order processing", processes: [] }
              ]
            }
          ],
          workflows: []
        }
      ],
      workflows: []
    },
    manufacturing: {
      name: orgName,
      description: "Manufacturing organization",
      departments: [
        {
          name: "Production",
          description: "Manufacturing and assembly",
          head: "VP of Manufacturing",
          teams: [
            {
              name: "Assembly Line",
              description: "Product assembly operations",
              teamLead: "Production Supervisor",
              teamMembers: ["Assembly Technician", "Quality Inspector", "Machine Operator", "Maintenance Tech"],
              tools: ["MES System", "Quality Management", "IoT Sensors", "CMMS"],
              workflows: [
                { name: "Production Scheduling", type: "agentic", description: "AI-optimized production scheduling", processes: [
                  { name: "Schedule Optimization", description: "Optimize production schedules", agents: [
                    { name: "Scheduling Agent", description: "AI that optimizes production schedules", automations: ["Analyze demand", "Optimize resource allocation", "Adjust for maintenance"] }
                  ]}
                ]}
              ]
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
              teamMembers: ["Buyer", "Supplier Relations", "Contract Manager", "Logistics Coordinator"],
              tools: ["SAP", "Coupa", "Supplier Portal", "Transportation Management"],
              workflows: [
                { name: "Purchase Order", type: "linear", description: "Procurement request and approval", processes: [] }
              ]
            }
          ],
          workflows: []
        }
      ],
      workflows: []
    },
    generic: {
      name: orgName,
      description: "General business organization",
      departments: [
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
              workflows: [
                { name: "Daily Operations", type: "linear", description: "Standard operating procedures", processes: [] }
              ]
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
              tools: ["ATS", "LinkedIn", "HRIS", "Background Check System"],
              workflows: [
                { name: "Hiring Process", type: "linear", description: "End-to-end recruitment workflow", processes: [] }
              ]
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
              tools: ["QuickBooks", "Excel", "Expense Management", "Banking Portal"],
              workflows: [
                { name: "Month-end Close", type: "linear", description: "Monthly financial closing process", processes: [] }
              ]
            }
          ],
          workflows: []
        }
      ],
      workflows: []
    }
  };

  return templates[orgType] || templates.generic;
}