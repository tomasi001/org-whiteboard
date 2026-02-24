import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `You are an expert organisational designer AI that thinks deeply about organisational structures. Your task is to generate comprehensive, realistic organisational structures based on user descriptions.

You must output valid JSON that matches this exact structure:
{
  "name": "Organisation Name",
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
1. The type of organisation (tech, healthcare, finance, retail, manufacturing, etc.)
2. The realistic size and complexity based on the description
3. Modern tools and systems that organisation would use
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

    // Check for Gemini API key
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    
    if (!apiKey) {
      // Fallback to mock response for development
      console.log('No GEMINI_API_KEY found, using mock response');
      return NextResponse.json(generateMockResponse(prompt));
    }

    // Use Gemini AI with @google/genai
    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${SYSTEM_PROMPT}\n\nGenerate an organisational structure for: ${prompt}`,
    });

    const content = response.text;

    if (!content) {
      return NextResponse.json(generateMockResponse(prompt));
    }

    try {
      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return NextResponse.json(parsed);
      }
      return NextResponse.json(generateMockResponse(prompt));
    } catch {
      return NextResponse.json(generateMockResponse(prompt));
    }
  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json({ error: 'Failed to generate organisation' }, { status: 500 });
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
  const orgName = nameMatch ? nameMatch[1].trim() : "My Organisation";

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
              description: "Product roadmap and feature prioritisation",
              teamLead: "Senior PM",
              teamMembers: ["Product Manager", "Business Analyst", "UX Researcher"],
              tools: ["Jira", "Confluence", "Amplitude", "Miro", "Notion"],
              workflows: [
                { name: "Roadmap Planning", type: "linear", description: "Quarterly roadmap development", processes: [] }
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
      description: "Healthcare organisation providing medical services",
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
        }
      ],
      workflows: []
    },
    finance: {
      name: orgName,
      description: "Financial services organisation",
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
              teamMembers: ["VP - M&A", "Associate", "Analyst"],
              tools: ["Bloomberg", "Capital IQ", "DealCloud", "FactSet"],
              workflows: [
                { name: "Deal Pipeline", type: "linear", description: "Track and manage M&A opportunities", processes: [] }
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
      description: "Retail organisation with stores and e-commerce",
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
              teamMembers: ["Assistant Manager", "Department Lead", "Sales Associate"],
              tools: ["POS System", "Inventory Management", "Scheduling Software"],
              workflows: [
                { name: "Daily Opening", type: "linear", description: "Store opening procedures", processes: [] }
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
      description: "Manufacturing organisation",
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
              teamMembers: ["Assembly Technician", "Quality Inspector", "Machine Operator"],
              tools: ["MES System", "Quality Management", "IoT Sensors"],
              workflows: [
                { name: "Production Scheduling", type: "agentic", description: "AI-optimised production scheduling", processes: [] }
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
      description: "General business organisation",
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
        }
      ],
      workflows: []
    }
  };

  return templates[orgType] || templates.generic;
}