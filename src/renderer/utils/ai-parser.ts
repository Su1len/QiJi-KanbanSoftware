import OpenAI from 'openai';

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

/**
 * Parse natural language input and return structured task data.
 * Requires the DeepSeek API key to be set.
 */
export async function parseTaskFromNaturalLanguage(
  input: string,
  apiKey: string
): Promise<ParsedTaskResult> {
  const client = new OpenAI({
    baseURL: DEEPSEEK_BASE_URL,
    apiKey: apiKey,
  });

  const systemPrompt = `你是一个任务解析助手。用户会用自然语言描述一个任务，请你将其解析为结构化数据。

请严格按照以下JSON格式返回（不要包含任何其他文字，只返回JSON）：
{
  "name": "主任务名称（简短概括）",
  "content": "事务具体内容与执行情况评估",
  "purpose": "目标",
  "resources": "所需资源",
  "duration": "工期估计",
  "effect": "预期效果",
  "hints": "注意要点",
  "approach": "实现路径",
  "relevants": "相关方及接洽人",
  "priority": 数字(0-10，默认0为普通，越大优先级越高),
  "status": "进行中|暂搁置",
  "sub_tasks": [
    { "name": "子任务1" },
    { "name": "子任务2" }
  ]
}

解析规则：
- priority: 如果用户提到"优先级高"、"紧急"、"优先"等词，设置为8-10；如果提到"不急"、"有空再做"，设置为1-3；默认为0
- hints: 如果用户提到"注意"、"别忘了"、"记得"等词，提取相关内容
- relevants: 如果用户提到人名或部门，提取为相关方
- duration: 如果用户提到截止日期、工期、天数，提取为工期
- 子任务：如果用户明确了步骤，拆分为子任务；如果没有，留空数组
- 所有未提及的字段留空字符串`;

  const response = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: input },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('AI 未返回有效响应');
  }

  // Parse the JSON response
  let jsonStr = content.trim();
  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return normalizeParsedTask(parsed);
  } catch {
    throw new Error('AI 返回的数据格式无效，请重试');
  }
}

function normalizeParsedTask(raw: any): ParsedTaskResult {
  return {
    name: String(raw.name || '未命名任务'),
    content: String(raw.content || ''),
    purpose: String(raw.purpose || ''),
    resources: String(raw.resources || ''),
    duration: String(raw.duration || ''),
    effect: String(raw.effect || ''),
    hints: String(raw.hints || ''),
    approach: String(raw.approach || ''),
    relevants: String(raw.relevants || ''),
    priority: typeof raw.priority === 'number' ? raw.priority : 0,
    status: raw.status === '暂搁置' ? '暂搁置' : '进行中',
    sub_tasks: Array.isArray(raw.sub_tasks)
      ? raw.sub_tasks.map((st: any) => ({ name: String(st.name || '') })).filter((st: any) => st.name)
      : [],
  };
}

export interface ParsedTaskResult {
  name: string;
  content: string;
  purpose: string;
  resources: string;
  duration: string;
  effect: string;
  hints: string;
  approach: string;
  relevants: string;
  priority: number;
  status: string;
  sub_tasks: { name: string }[];
}
