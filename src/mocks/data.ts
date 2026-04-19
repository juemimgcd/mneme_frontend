import type {
  AbilityTag,
  ActivityItem,
  AuthToken,
  ChatExchange,
  CompanionAnswerResult,
  DashboardMetric,
  DocumentItem,
  GrowthAdviceResult,
  GrowthReport,
  KnowledgeBase,
  MemoryLibrary,
  PersonalProfile,
  TaskRecord,
  User,
} from '@/lib/types';

export const demoUser: User = {
  id: 1,
  username: 'mneme_demo',
  display_name: 'Mneme Demo',
  avatar_url: '/static/avatars/default.png',
  created_at: '2026-04-18T09:00:00Z',
};

export const demoToken: AuthToken = {
  access_token: 'demo-mneme-token',
  token_type: 'bearer',
};

export const knowledgeBases: KnowledgeBase[] = [
  {
    id: 'kb_life_writing',
    user_id: 1,
    name: '人生写作总库',
    description: '博客、年度总结、长文复盘和播客笔记。',
    is_default: true,
    created_at: '2026-04-01T12:20:00Z',
    document_count: 12,
    memory_count: 86,
    updated_at: '2026-04-18T12:20:00Z',
    status: 'ready',
  },
  {
    id: 'kb_product_research',
    user_id: 1,
    name: '产品研究档案',
    description: '竞品拆解、访谈纪要、需求假设和实验记录。',
    is_default: false,
    created_at: '2026-04-02T16:10:00Z',
    document_count: 8,
    memory_count: 52,
    updated_at: '2026-04-17T16:10:00Z',
    status: 'indexing',
  },
  {
    id: 'kb_reading_notes',
    user_id: 1,
    name: '阅读卡片库',
    description: '书摘、课程摘要与引用片段。',
    is_default: false,
    created_at: '2026-04-03T08:40:00Z',
    document_count: 24,
    memory_count: 131,
    updated_at: '2026-04-16T08:40:00Z',
    status: 'ready',
  },
];

export const documents: DocumentItem[] = [
  {
    id: 'doc_annual_review_2025',
    user_id: 1,
    file_name: '2025 年度复盘.pdf',
    name: '2025 年度复盘.pdf',
    knowledge_base_id: 'kb_life_writing',
    file_type: 'pdf',
    status: 'indexed',
    page_count: 18,
    chunk_count: 64,
    created_at: '2026-04-18T09:20:00Z',
    size_label: '4.8 MB',
  },
  {
    id: 'doc_habit_field_notes',
    user_id: 1,
    file_name: '习惯实验田野笔记.md',
    name: '习惯实验田野笔记.md',
    knowledge_base_id: 'kb_life_writing',
    file_type: 'md',
    status: 'indexed',
    page_count: 7,
    chunk_count: 26,
    created_at: '2026-04-17T11:30:00Z',
    size_label: '320 KB',
  },
  {
    id: 'doc_product_interviews',
    user_id: 1,
    file_name: '用户访谈第 4 轮.txt',
    name: '用户访谈第 4 轮.txt',
    knowledge_base_id: 'kb_product_research',
    file_type: 'txt',
    status: 'indexing',
    page_count: 10,
    chunk_count: 0,
    created_at: '2026-04-18T10:12:00Z',
    size_label: '160 KB',
    task_id: 'task_doc_product_interviews',
  },
];

export const chatHistory: ChatExchange[] = [
  {
    id: 'chat_1',
    question: '我在 2025 年的成长主题里，最反复出现的关键词是什么？',
    answer:
      '从已索引内容看，出现频率最高的是“长期主义”“节律修复”和“写作作为认知外骨骼”。这些主题同时出现在年度复盘、习惯实验和阅读卡片中，说明你的成长并不是围绕一次性冲刺，而是围绕稳定可复用的个人系统在收敛。',
    sources: [
      {
        knowledge_base_id: 'kb_life_writing',
        document_id: 'doc_annual_review_2025',
        chunk_id: 'chunk_annual_17..chunk_annual_18',
        page_no: null,
        text: '我不再把效率理解成多做，而是把它理解成能否长期维持写作、运动、复盘这三个底盘动作。',
        source_chunk_ids: ['chunk_annual_17', 'chunk_annual_18'],
        source_page_nos: [6, 7],
        merged_chunk_count: 2,
      },
    ],
    created_at: '2026-04-18T12:40:00Z',
  },
];

export const memoryLibrary: MemoryLibrary = {
  timeline: [
    {
      entry_id: 'entry_01',
      entry_name: '重建晨间节律',
      entry_type: 'habit',
      summary: '通过写作和步行恢复日内节律，把一天的开头固定下来。',
      created_at: '2026-03-10T09:00:00Z',
    },
    {
      entry_id: 'entry_02',
      entry_name: '从记录转向分析',
      entry_type: 'insight',
      summary: '不只保存素材，而是开始提取主题与证据链。',
      created_at: '2026-03-28T20:00:00Z',
    },
    {
      entry_id: 'entry_03',
      entry_name: '知识库即作品集',
      entry_type: 'belief',
      summary: '把知识库看作持续生成的作品，而不是归档抽屉。',
      created_at: '2026-04-08T22:30:00Z',
    },
  ],
  by_type: {
    habit: ['重建晨间节律', '固定每周复盘'],
    insight: ['从记录转向分析', '长期写作比短期爆发更重要'],
    belief: ['知识库即作品集'],
  },
  by_theme: [
    {
      theme_name: '长期主义',
      entries: ['重建晨间节律', '固定每周复盘', '知识库即作品集'],
      count: 3,
    },
    {
      theme_name: '认知升级',
      entries: ['从记录转向分析', '长期写作比短期爆发更重要'],
      count: 2,
    },
  ],
};

const abilityTags: AbilityTag[] = [
  {
    ability_name: '叙事型学习',
    reason: '你反复通过写作和复盘整合材料，而不是只保留碎片记录。',
    evidence_entries: ['从记录转向分析', '知识库即作品集'],
  },
  {
    ability_name: '结构化实验',
    reason: '会在习惯和产品研究中构造假设、追踪变化、记录反馈。',
    evidence_entries: ['重建晨间节律'],
  },
];

export const profileInsights: PersonalProfile = {
  knowledge_base_id: 'kb_life_writing',
  entry_count: 86,
  profile_summary:
    '你更像通过写作和长期积累来构建认知系统的人，关注节律、复盘和主题收敛，而不是一次性冲刺。',
  main_themes: [
    {
      theme_name: '长期主义',
      reason: '多个时期的词条都指向稳定投入和缓慢积累。',
      evidence_entries: ['重建晨间节律', '知识库即作品集'],
    },
    {
      theme_name: '认知整理',
      reason: '内容不只停留在记录层，而是持续向结构化分析推进。',
      evidence_entries: ['从记录转向分析'],
    },
  ],
  ability_tags: abilityTags,
  expression_style: '偏叙事、偏总结、重视上下文和自我观察。',
  growth_focus: ['稳定写作节律', '主题收敛', '让知识可复用'],
};

export const growthMetrics: GrowthReport = {
  knowledge_base_id: 'kb_life_writing',
  analysis_window: '最近 30 天',
  stage_summary: '你正从“收集材料”过渡到“持续提炼自己的主题系统”。',
  recent_focus: ['长期主义', '节律修复', '写作即索引'],
  theme_changes: [
    {
      theme_name: '长期主义',
      change_type: 'stronger',
      reason: '近期条目中该主题的频率更高，且表述更具体。',
      evidence_entries: ['重建晨间节律', '知识库即作品集'],
    },
  ],
  highlights: ['阶段性输出更稳定', '开始把素材转成主题簇'],
  blockers: ['旧材料仍未完全索引', '部分主题还停留在单点记录'],
  next_actions: ['优先清理待索引文档', '继续围绕固定主题做周复盘'],
};

export const growthAdvice: GrowthAdviceResult = {
  knowledge_base_id: 'kb_life_writing',
  focus_goal: 'Turn recent notes into reusable RAG memory',
  advice_summary:
    'The highest-leverage move is tightening one repeatable loop: index, rebuild memory, review the strongest cluster, and publish one compact output.',
  current_priorities: [
    'Stabilize rebuild cadence',
    'Consolidate one theme cluster',
    'Turn notes into reusable outputs',
  ],
  action_suggestions: [
    {
      area: 'Memory hygiene',
      why_now: 'Recurring themes already exist, but they are still split across unevenly processed material.',
      action: 'Run one clean rebuild after each indexing batch and review the newest entries immediately.',
      first_step: 'Finish a rebuild for the active collection and verify the latest entries in memory.',
      evidence_entries: ['从记录转向分析', '知识库即作品集'],
    },
    {
      area: 'Output loop',
      why_now: 'Your profile is strongest when raw notes get compressed into a concise narrative artifact.',
      action: 'Ship one short weekly synthesis from the strongest memory cluster.',
      first_step: 'Pick one theme and write a 300-word note with citations.',
      evidence_entries: ['重建晨间节律', '知识库即作品集'],
    },
  ],
  avoid_list: [
    'Adding large uncategorized files without a rebuild pass',
    'Switching themes before one weekly loop is complete',
  ],
  one_week_plan: [
    'Day 1: refresh outputs',
    'Day 3: review the top memory cluster',
    'Day 5: draft one synthesis note',
    'Day 7: compare the updated profile and growth signals',
  ],
  reflection_questions: [
    'Which theme is becoming more precise, not just more frequent?',
    'What output would most improve future retrieval quality?',
  ],
};

export const companionAnswer: CompanionAnswerResult = {
  knowledge_base_id: 'kb_life_writing',
  question: 'What should I focus on next if I want better memory quality?',
  direct_answer:
    'Focus on one disciplined loop: finish indexing, rebuild memory, then turn the strongest cluster into a compact written output.',
  citations: [
    {
      document_id: 'doc_annual_review_2025',
      chunk_id: 'chunk_annual_17',
      page_no: 6,
      text: '我不再把效率理解成多做，而是把它理解成能否长期维持写作、运动、复盘这三个底盘动作。',
      reason: 'This supports optimizing for a stable loop instead of adding more material.',
    },
  ],
  profile_snapshot:
    'The profile layer describes a narrative learner who improves by turning raw material into structured reflection.',
  growth_snapshot:
    'Recent growth indicates a shift from collecting material toward extracting stable themes and reusable memory.',
  next_step_hint: 'Run one memory rebuild after the latest documents finish indexing.',
  follow_up_questions: [
    'Which theme should become the next output?',
    'What documents are still weakening retrieval quality?',
  ],
  companion_message:
    'You do not need more input right now. You need one tighter cycle that converts existing material into cleaner memory.',
};

export const taskRecords: TaskRecord[] = [
  {
    id: 'task_doc_product_interviews',
    task_type: 'document_index',
    target_id: 'doc_product_interviews',
    status: 'indexing',
    error_message: null,
    created_at: '2026-04-18T10:13:00Z',
    updated_at: '2026-04-18T10:15:00Z',
  },
];

export const dashboardMetrics: DashboardMetric[] = [
  {
    label: 'Collections',
    value: '3',
    change: '+1 this week',
    tone: 'teal',
  },
  {
    label: 'Indexed Docs',
    value: '44',
    change: '86 memory items',
    tone: 'indigo',
  },
  {
    label: '7-Day Queries',
    value: '19',
    change: '94% retrieval hit rate',
    tone: 'amber',
  },
  {
    label: 'Pending Index',
    value: '1',
    change: 'needs attention',
    tone: 'coral',
  },
];

export const activityFeed: ActivityItem[] = [
  {
    id: 'activity_1',
    title: 'Annual review finished indexing',
    detail: 'Added 64 chunks and made them available for retrieval and theme analysis.',
    timestamp: 'Today 12:20',
    tone: 'teal',
  },
  {
    id: 'activity_2',
    title: 'Product research started a new index run',
    detail: 'The system accepted round four of user interviews and moved it into async processing.',
    timestamp: 'Today 10:12',
    tone: 'amber',
  },
  {
    id: 'activity_3',
    title: 'Profile report refreshed',
    detail: 'Recent material strengthened the "narrative learner" tag.',
    timestamp: 'Yesterday 21:40',
    tone: 'indigo',
  },
];
