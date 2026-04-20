【项目背景与当前状况】 我正在开发一个基于 Vue 3 + TypeScript + CSS 的前端项目 mneme_frontend。目前项目中有一个 src/views/GraphView.vue，负责渲染知识图谱。它已经定义了基础的数据结构（如 GraphNode, GraphEdge）以及基础的状态管理（如 viewport 的缩放和平移、选中节点、筛选器等）。

【目标任务】 请重构并深度优化 src/views/GraphView.vue 及相关的图谱渲染逻辑，使其达到类似 Obsidian (双链笔记) 的高级图谱效果。

【详细执行步骤与技术规格】

1. 引入并集成物理引擎 (d3-force)
当前系统缺乏真实的物理碰撞和引力模拟。

动作：使用 d3-force 作为底层的物理引擎。你需要新增依赖 d3-force 和其类型定义 @types/d3-force。
实现细节：
在 GraphView.vue 中初始化一个 forceSimulation。
配置力学模型：
forceLink：根据 edge 数据创建连接力。引入 distance（基础连接距离）和 strength（连接强度）。
forceManyBody：为节点添加排斥力（电荷力），确保节点不会过度重叠，建议强度设置为 -150 到 -300。
forceCenter：添加向画布中心的引力，防止节点飞出屏幕。
forceCollide：添加碰撞力，半径使用节点自身的渲染半径加上一个 padding（如 2px），防止节点贴贴。
在 Vue 的 watch 或 onMounted 中，当 visibleGraph 变化时，重新把 nodes 和 edges 喂给 simulation 并重启 alpha。
2. 节点与连线的视觉渲染算法 (模仿 Obsidian)
节点大小 (Node Size)：节点的半径 (radius) 不能是固定的。需要根据节点的度 (Degree/连线数量) 来动态计算。计算公式建议为：基础大小 + Math.sqrt(连线数) * 缩放系数。
节点颜色 (Node Color)：根据 node.node_type 或者所属的分类赋予不同的颜色。定义一组 CSS 变量或常量色盘（例如：文档节点为紫色，记忆/标签节点为蓝色，附件为绿色等）。
连线样式 (Edge Styling)：
连线默认为半透明的灰色/暗色，需要有平滑的过渡。
线宽根据 edge 的权重（如有）动态调整，默认 1px。
标签显示 (Labels)：
大节点（连线多的）的文字标签始终显示。
小节点的标签在 viewport.scale（缩放层级）放大到一定程度（如 > 1.2）时才显示，或者在鼠标 hover 时显示。以此减少视觉噪音。
3. 核心交互逻辑 (Hover & Highlight)
这是 Obsidian 图谱体验的核心：

状态管理：新增 hoveredNodeId 和 highlightedNodeIds (Set) 以及 highlightedEdgeIds (Set)。
Hover 触发：当鼠标悬浮在一个节点上时：
高亮该节点自身。
高亮与该节点直接相连 (1度连接) 的所有邻居节点。
高亮连接这些节点的线 (Edges)。
视觉压暗 (Dimming)：将不在 highlightedNodeIds 中的节点透明度降至 0.1 左右，未高亮的线透明度降至 0.05。
拖拽交互 (Drag)：结合 d3-force，允许用户拖拽节点。拖拽开始时设置 simulation.alphaTarget(0.3).restart()，拖拽过程中更新节点的 fx 和 fy (固定坐标)，拖拽结束时释放。
4. 渲染层的重构 (SVG vs Canvas)
如果图谱节点数在 500 以内，继续使用 SVG 渲染（保留当前的 Vue 模板驱动方式，将 forceSimulation 算出的 x 和 y 响应式地绑定到 <circle> 和 <line> 上，配合 gsap 做平滑）。
要求在 <template> 结构中：
使用 <svg> 包含一个用 <g :transform="...缩放和平移..."> 包裹的主图层。
先渲染 <g class="edges"> (连线在下层)。
再渲染 <g class="nodes"> (节点在上层)。
最后渲染 <g class="labels"> (文字在最上层，并应用 CSS 的 pointer-events: none 防止遮挡 hover 触发)。
5. 样式表 (CSS/暗色主题适配)
请在 <style scoped> 中添加类似以下的样式属性，营造极客感：

CSS
/* 示例代码供 AI 参考 */
.graph-container {
  background-color: var(--surface-background, #1e1e1e); /* Obsidian 深色背景 */
  overflow: hidden;
}
.graph-edge {
  stroke: rgba(255, 255, 255, 0.2);
  transition: stroke 0.2s, stroke-width 0.2s;
}
.graph-edge.is-highlighted {
  stroke: rgba(255, 255, 255, 0.8);
  stroke-width: 2px;
}
.graph-edge.is-dimmed {
  stroke: rgba(255, 255, 255, 0.05);
}
.graph-node {
  transition: opacity 0.2s, r 0.2s, fill 0.2s;
  stroke: var(--surface-background);
  stroke-width: 2px;
}
.graph-node.is-dimmed {
  opacity: 0.15;
}
.graph-label {
  fill: #e0e0e0;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  pointer-events: none;
  text-shadow: 0 1px 3px rgba(0,0,0,0.8); /* 边缘描边让文字在任何背景下清晰 */
  transition: opacity 0.2s;
}
.graph-label.is-dimmed {
  opacity: 0;
}
6. 整合目前的视口 (Viewport) 逻辑
保留已有的 viewport (x, y, scale) 和 gsap 的 viewportTween。确保 d3 的物理计算只负责相对坐标，缩放和平移依然交由 Vue 的 transform: translate(x, y) scale(s) 来完成。添加鼠标滚轮 (Wheel) 事件来控制缩放，中键或右键/拖拽背景来控制平移。