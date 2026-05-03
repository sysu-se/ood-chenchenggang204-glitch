# EVOLUTION.md

## 1. 我如何实现提示功能？

本次把提示能力放回领域对象，而不是在 Svelte 组件里临时计算。

- `Sudoku.getCandidates(row, col)` 根据当前行、列、九宫格约束返回某个空格的合法候选数。
- `Sudoku.getCandidateHint(row, col)` 在候选数之外返回一段解释文字。
- `Sudoku.getNextHint()` 扫描当前棋盘，寻找候选数只有一个的空格，作为“下一步推定数”。
- `Game.getCandidateHint(...)` 和 `Game.getNextHint()` 对外暴露这些能力，并额外尊重固定格规则。
- UI 通过 `gameSession` / `@sudoku/stores/grid` 调用领域接口，不再用 solver 在组件中直接填答案。

目前实现的是基础的 naked single：如果一个空格只有一个合法候选值，就认为它是可推定的下一步。

## 2. 提示功能更属于 `Sudoku` 还是 `Game`？

候选数计算更属于 `Sudoku`，因为它依赖的是棋盘本身的数独约束：行、列、九宫格不能重复。

但“能不能提示给用户”“能不能填入这个格子”更属于 `Game`，因为 `Game` 才知道题面固定格、当前会话状态、undo/redo 与探索模式。所以本次设计采用协作方式：

- `Sudoku` 负责纯棋盘推理；
- `Game` 负责把推理结果放进游戏会话规则中；
- UI 只消费 `Game` / store adapter 暴露出的命令和快照。

## 3. 我如何实现探索模式？

探索模式由 `Game` 显式管理。调用 `startExplore()` 时，`Game` 会保存当前 `Sudoku` 的入口快照，并创建一组独立的探索 undo/redo 栈。探索期间的 `guess()` 不进入主 history，而是进入探索 history。

探索模式支持：

- `startExplore()`：进入探索；
- `commitExplore()`：将探索过程中的 move 合并进主 history；
- `discardExplore()`：丢弃探索结果，回到入口快照；
- `getExploreState()`：返回是否处于探索、是否失败、失败原因、是否可提交等状态。

如果探索中出现重复数字冲突，或某个空格没有合法候选数，`Game` 会把当前局面记录为失败路径。之后再次到达同一局面时，`getExploreState()` 会报告这个局面已经属于失败探索路径。

## 4. 主局面与探索局面的关系是什么？

主局面和探索局面不共享同一个 `Sudoku` 入口对象。进入探索时，`Game` 通过 `currentSudoku.clone()` 保存一份入口快照。

探索期间，当前棋盘会继续变化，便于 UI 正常显示和输入；但是主 history 暂时不接收探索 move。这样可以避免主局面和探索局面之间互相污染。

- 提交时：把探索 undo 栈中的 move 追加到主 undo 栈，并清空主 redo 栈。
- 放弃时：用入口快照恢复 `currentSudoku`，探索 history 直接丢弃。
- 序列化时：如果正在探索，会保存探索入口快照、探索 undo/redo 栈，以及已经记忆的失败局面。

## 5. history 结构是否发生变化？

发生了小幅演进，但仍然保持线性栈。

普通模式下，history 仍然是 Homework 1 的 `undoStack` / `redoStack`。探索模式下，`Game` 临时使用 `explore.undoStack` / `explore.redoStack`。这是一段独立的线性 history，不是树状 DAG。

提交探索时，探索栈被线性追加到主 undo 栈；放弃探索时，探索栈被丢弃。这样满足本次作业要求，又避免过早引入复杂分支合并语义。

## 6. Homework 1 的哪些设计暴露出了局限？

第一，上一版 `Game` 同时维护 `currentSudoku` 与 `puzzleGrid`，但没有校验二者是否来自同一盘题。本次在 `createGame()` 中增加了固定格一致性校验，避免题面和当前局面描述不同 puzzle。

第二，上一版 UI 中存在多条命令入口：有的组件直接调 `gameSession`，有的调 `@sudoku/stores/grid`，还有的调 `@sudoku/game`。本次把导入、导出、撤销、重做、探索等操作尽量收敛到 `@sudoku/game` 和 store adapter。

第三，上一版 hint 实际上在 UI 包装层里调用 solver 直接填答案，这不利于说明对象协作。本次把候选和下一步提示变成 `Sudoku` / `Game` 的领域接口。

## 7. 如果重做 Homework 1，我会如何修改原设计？

如果重新做 Homework 1，我会更早明确三层边界：

- `Sudoku` 只处理棋盘规则、候选、冲突、序列化；
- `Game` 处理固定格、会话状态、history、探索状态；
- Svelte store 只做响应式快照和命令转发，不暴露可变领域对象。

我也会从一开始就让 `Game` 的构造函数校验初始题面和当前棋盘的一致性，并让 UI 只依赖一个稳定的命令入口。这样 Homework 2 增加 Hint / Explore 时，就不会需要再回头整理 UI 调用路径。
