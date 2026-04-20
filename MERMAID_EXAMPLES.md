# Karpathy 知识库树形结构 - Mermaid 示例

## 完整树示例

```mermaid
graph TD
    U["👤 User<br/>John Doe"]
    
    KB1["📚 KnowledgeBase<br/>AI Learning"]
    KB2["📚 KnowledgeBase<br/>Project Notes"]
    
    DOC1["📄 Document<br/>transformer.pdf"]
    DOC2["📄 Document<br/>attention.md"]
    DOC3["📄 Document<br/>research.pdf"]
    
    MEM1["💡 MemoryEntry<br/>Attention Mechanism<br/>⭐⭐⭐"]
    MEM2["💡 MemoryEntry<br/>Self-Attention<br/>⭐⭐"]
    MEM3["💡 MemoryEntry<br/>Query-Key-Value<br/>⭐⭐⭐"]
    MEM4["💡 MemoryEntry<br/>Project Plan<br/>⭐⭐"]
    
    U --> KB1
    U --> KB2
    KB1 --> DOC1
    KB1 --> DOC2
    KB2 --> DOC3
    DOC1 --> MEM1
    DOC1 --> MEM2
    DOC1 --> MEM3
    DOC3 --> MEM4
    
    DOC1 -.->|related| DOC3
    
    style U fill:#f0f0f0,stroke:#1a1a1a,stroke-width:2px
    style KB1 fill:#ffffff,stroke:#d0d0d0,stroke-width:1px
    style KB2 fill:#ffffff,stroke:#d0d0d0,stroke-width:1px
    style DOC1 fill:#ffffff,stroke:#d0d0d0,stroke-width:1px
    style DOC2 fill:#ffffff,stroke:#d0d0d0,stroke-width:1px
    style DOC3 fill:#ffffff,stroke:#d0d0d0,stroke-width:1px
    style MEM1 fill:#ffffff,stroke:#0066cc,stroke-width:2px
    style MEM2 fill:#ffffff,stroke:#0066cc,stroke-width:1px
    style MEM3 fill:#ffffff,stroke:#0066cc,stroke-width:2px
    style MEM4 fill:#ffffff,stroke:#009900,stroke-width:1px
```

## 知识库子树示例

```mermaid
graph TD
    KB["📚 AI Learning"]
    
    DOC1["📄 transformer.pdf<br/>1.2 MB"]
    DOC2["📄 attention.md<br/>45 KB"]
    
    MEM1["💡 Attention<br/>⭐⭐⭐"]
    MEM2["💡 Query-Key-Value<br/>⭐⭐"]
    MEM3["💡 Multi-Head<br/>⭐⭐⭐"]
    MEM4["💡 Positional Encoding<br/>⭐⭐"]
    
    KB --> DOC1
    KB --> DOC2
    DOC1 --> MEM1
    DOC1 --> MEM2
    DOC1 --> MEM3
    DOC2 --> MEM4
    
    style KB fill:#f8f8f8,stroke:#1a1a1a,stroke-width:2px
    style DOC1 fill:#ffffff,stroke:#d0d0d0
    style DOC2 fill:#ffffff,stroke:#d0d0d0
    style MEM1 fill:#ffffff,stroke:#0066cc,stroke-width:2px
    style MEM2 fill:#ffffff,stroke:#0066cc
    style MEM3 fill:#ffffff,stroke:#0066cc,stroke-width:2px
    style MEM4 fill:#ffffff,stroke:#0066cc
```

## 文档关联示例

```mermaid
graph TD
    DOC1["📄 Transformer Architecture"]
    DOC2["📄 Attention Mechanisms"]
    DOC3["📄 BERT Implementation"]
    
    MEM1["💡 Self-Attention"]
    MEM2["💡 Multi-Head Attention"]
    MEM3["💡 Positional Encoding"]
    MEM4["💡 Feed Forward"]
    MEM5["💡 Layer Normalization"]
    
    DOC1 --> MEM1
    DOC1 --> MEM2
    DOC1 --> MEM3
    DOC1 --> MEM4
    
    DOC2 --> MEM1
    DOC2 --> MEM2
    DOC2 --> MEM5
    
    DOC3 --> MEM1
    DOC3 --> MEM2
    DOC3 --> MEM4
    DOC3 --> MEM5
    
    DOC1 -.->|shared: Self-Attention, Multi-Head| DOC2
    DOC1 -.->|shared: All| DOC3
    DOC2 -.->|shared: Layer Norm| DOC3
    
    style DOC1 fill:#ffffff,stroke:#d0d0d0,stroke-width:2px
    style DOC2 fill:#ffffff,stroke:#d0d0d0,stroke-width:2px
    style DOC3 fill:#ffffff,stroke:#d0d0d0,stroke-width:2px
    style MEM1 fill:#ffffff,stroke:#0066cc
    style MEM2 fill:#ffffff,stroke:#0066cc
    style MEM3 fill:#ffffff,stroke:#0066cc
    style MEM4 fill:#ffffff,stroke:#0066cc
    style MEM5 fill:#ffffff,stroke:#0066cc
```

## 按类型分组示例

```mermaid
graph TD
    KB["📚 Machine Learning"]
    
    CONCEPT["🏷️ Concepts"]
    INSIGHT["💭 Insights"]
    QUESTION["❓ Questions"]
    ACTION["✅ Actions"]
    
    C1["💡 Neural Network"]
    C2["💡 Backpropagation"]
    C3["💡 Gradient Descent"]
    
    I1["💡 Overfitting Prevention"]
    I2["💡 Learning Rate Impact"]
    
    Q1["💡 How to tune hyperparameters?"]
    Q2["💡 When to use dropout?"]
    
    A1["✅ Implement batch normalization"]
    A2["✅ Test with different architectures"]
    
    KB --> CONCEPT
    KB --> INSIGHT
    KB --> QUESTION
    KB --> ACTION
    
    CONCEPT --> C1
    CONCEPT --> C2
    CONCEPT --> C3
    
    INSIGHT --> I1
    INSIGHT --> I2
    
    QUESTION --> Q1
    QUESTION --> Q2
    
    ACTION --> A1
    ACTION --> A2
    
    style KB fill:#f8f8f8,stroke:#1a1a1a,stroke-width:2px
    style CONCEPT fill:#ffffff,stroke:#0066cc,stroke-width:2px
    style INSIGHT fill:#ffffff,stroke:#009900,stroke-width:2px
    style QUESTION fill:#ffffff,stroke:#cc6600,stroke-width:2px
    style ACTION fill:#ffffff,stroke:#cc0066,stroke-width:2px
```

## 时间线示例

```mermaid
graph LR
    subgraph "Week 1"
        M1["💡 Basics"]
        M2["💡 Fundamentals"]
    end
    
    subgraph "Week 2"
        M3["💡 Advanced Concepts"]
        M4["💡 Implementation"]
    end
    
    subgraph "Week 3"
        M5["💡 Optimization"]
        M6["💡 Best Practices"]
    end
    
    M1 --> M2
    M2 --> M3
    M3 --> M4
    M4 --> M5
    M5 --> M6
    
    style M1 fill:#ffffff,stroke:#0066cc
    style M2 fill:#ffffff,stroke:#0066cc
    style M3 fill:#ffffff,stroke:#0066cc
    style M4 fill:#ffffff,stroke:#0066cc
    style M5 fill:#ffffff,stroke:#0066cc
    style M6 fill:#ffffff,stroke:#0066cc
```

---

## 如何使用这些示例

### 1. 在 Obsidian 中查看

复制 Mermaid 代码块到 Obsidian 笔记，会自动渲染为图表。

### 2. 在 GitHub 中查看

在 GitHub README 或 Issues 中粘贴 Mermaid 代码块，会自动渲染。

### 3. 在 Mermaid Live Editor 中查看

访问 https://mermaid.live，粘贴代码块查看实时渲染。

### 4. 导出为图片

使用 Mermaid CLI：

```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i tree.md -o tree.png
```

---

## 自定义样式

### 修改颜色

```mermaid
graph TD
    A["节点 A"]
    B["节点 B"]
    
    A --> B
    
    style A fill:#667eea,stroke:#333,stroke-width:2px,color:#fff
    style B fill:#764ba2,stroke:#333,stroke-width:2px,color:#fff
```

### 修改形状

```mermaid
graph TD
    A["矩形"]
    B("圆角矩形")
    C{菱形}
    D["方形"]
    
    A --> B
    B --> C
    C --> D
```

### 添加子图

```mermaid
graph TD
    subgraph KB["知识库"]
        DOC1["文档 1"]
        DOC2["文档 2"]
    end
    
    subgraph MEM["记忆条目"]
        M1["条目 1"]
        M2["条目 2"]
    end
    
    DOC1 --> M1
    DOC2 --> M2
```

---

## 性能建议

- 对于超过 100 个节点的树，建议分层显示
- 使用虚拟滚动优化大型树的渲染
- 对于关联边线，建议限制显示数量（max_related_edges）
- 使用 Canvas 而非 SVG 绘制大量边线
