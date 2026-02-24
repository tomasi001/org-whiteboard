import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const GENERATE_SYSTEM_PROMPT = `You are an expert organisational designer AI that thinks deeply about organisational structures. Your task is to generate comprehensive, realistic organisational structures based on user descriptions.

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

const CONVERSATION_SYSTEM_PROMPT = `You are an expert organisational designer helping users build their organisation step by step through conversation.

When the user provides information about their organisation, you should:
1. Acknowledge what they've shared
2. Ask follow-up questions to gather more details
3. Provide guidance on next steps

IMPORTANT: You must ALWAYS respond with valid JSON in this exact format:
{
  "guidance": "Your conversational response with guidance and next question",
  "previewData": { // Only include this when you have enough info to show a preview structure
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
            "workflows": []
          }
        ],
        "workflows": []
      }
    ],
    "workflows": []
  }
}

Guidelines:
- Keep guidance concise (2-4 sentences) and conversational
- Ask one focused question at a time
- Only include previewData when you have meaningful structure to show (at least org name + 1 department)
- If previewData is not ready yet, set it to null
- Be helpful and encouraging

Output ONLY valid JSON, no markdown formatting or explanations.`;

export async function POST(request: NextRequest) {
  try {
    const { prompt, mode, orgData, currentStep } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Check for Gemini API key
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    
    if (!apiKey) {
      // Fallback to mock response for development
      console.log('No GEMINI_API_KEY found, using mock response');
      
      if (mode === 'conversation') {
        return NextResponse.json(generateMockConversationResponse(prompt, orgData, currentStep));
      }
      return NextResponse.json(generateMockResponse(prompt));
    }

    // Use Gemini AI with @google/genai
    const ai = new GoogleGenAI({ apiKey });
    
    let contents: string;
    let systemPrompt: string;
    
    if (mode === 'conversation') {
      systemPrompt = CONVERSATION_SYSTEM_PROMPT;
      contents = `${CONVERSATION_SYSTEM_PROMPT}\n\nCurrent conversation context:\n- Current step: ${currentStep || 'intro'}\n- Org data so far: ${JSON.stringify(orgData || {})}\n- User message: ${prompt}\n\nRespond with JSON containing guidance and optional previewData.`;
    } else {
      systemPrompt = GENERATE_SYSTEM_PROMPT;
      contents = `${GENERATE_SYSTEM_PROMPT}\n\nGenerate an organisational structure for: ${prompt}`;
    }
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
    });

    const content = response.text;

    if (!content) {
      if (mode === 'conversation') {
        return NextResponse.json(generateMockConversationResponse(prompt, orgData, currentStep));
      }
      return NextResponse.json(generateMockResponse(prompt));
    }

    try {
      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // If in conversation mode, wrap in our expected format
        if (mode === 'conversation') {
          return NextResponse.json({
            guidance: parsed.guidance || "Thanks for sharing that! Let me ask a follow-up question.",
            previewData: parsed.previewData || null,
          });
        }
        
        return NextResponse.json(parsed);
      }
      
      if (mode === 'conversation') {
        return NextResponse.json(generateMockConversationResponse(prompt, orgData, currentStep));
      }
      return NextResponse.json(generateMockResponse(prompt));
    } catch {
      if (mode === 'conversation') {
        return NextResponse.json(generateMockConversationResponse(prompt, orgData, currentStep));
      }
      return NextResponse.json(generateMockResponse(prompt));
    }
  } catch (error) {
    console.error('Generate API error:', error);
    return NextResponse.json({ error: 'Failed to generate organisation' }, { status: 500 });
  }
}

function generateMockConversationResponse(prompt: string, orgData: any, currentStep: string) {
  const stepQuestions: Record<string, string> = {
    intro: "Thanks for sharing! Now let's talk about your **departments**. What are the main departments or divisions in your organisation? For example: Engineering, Sales, Marketing, Operations, etc.",
    departments: "Great! Now let's map out your **teams**. Within each department, what teams exist? For example, Engineering might have Frontend, Backend, DevOps teams.",
    teams: "Excellent! Now let's identify **roles and people**. Who are the key people in each team? What are their roles?",
    roles: "Perfect! Now let's document the **tools** each team uses. What software, platforms, or tools does each team rely on?",
    tools: "Almost there! Let's map out your **workflows and processes**. What are the key processes in your organisation?",
    review: "Let's **review** everything we've gathered. Ready to generate your org chart?",
  };

  const defaultGuidance = stepQuestions[currentStep] || stepQuestions.intro;
  
  // Check if we have enough data to show a preview
  const hasOrgName = orgData?.name || prompt.toLowerCase().includes('company') || prompt.toLowerCase().includes('organisation');
  const hasDepartments = orgData?.departments?.length > 0 || 
    prompt.toLowerCase().includes('engineering') || 
    prompt.toLowerCase().includes('sales') ||
    prompt.toLowerCase().includes('marketing');

  // Extract org name if mentioned
  let orgName = orgData?.name || 'My Organisation';
  const nameMatch = prompt.match(/(?:called|named|is|for)\s+["']?([A-Z][a-zA-Z\s]+?)["']?(?:\s|,|\.|$)/i);
  if (nameMatch && !orgData?.name) {
    orgName = nameMatch[1].trim();
  }

  // Generate preview data if we have enough info
  let previewData = null;
  if (hasOrgName) {
    const departments: any[] = [];
    
    if (hasDepartments || orgData?.departments?.length > 0) {
      // Extract departments from prompt
      const deptKeywords = ['engineering', 'sales', 'marketing', 'operations', 'product', 'hr', 'finance', 'support'];
      for (const dept of deptKeywords) {
        if (prompt.toLowerCase().includes(dept) || orgData?.departments?.includes(dept)) {
          departments.push({
            name: dept.charAt(0).toUpperCase() + dept.slice(1),
            description: `${dept.charAt(0).toUpperCase() + dept.slice(1)} department`,
            head: '',
            teams: [],
            workflows: []
          });
        }
      }
    }
    
    if (departments.length > 0 || orgData?.departments?.length > 0) {
      previewData = {
        name: orgName,
        description: orgData?.description || 'Organisation description',
        departments: departments.length > 0 ? departments : [
          { name: "Operations", description: "Core operations", head: "", teams: [], workflows: [] }
        ],
        workflows: []
      };
    }
  }

  return {
    guidance: defaultGuidance,
    previewData,
  };
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