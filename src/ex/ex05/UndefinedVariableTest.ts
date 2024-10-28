import { Scene, SceneConfig, UndefinedVariableChecker, UndefinedVariableSolver } from 'arkanalyzer';

const projectRoot = 'src/ex/resources/UndefinedVariable';
let config: SceneConfig = new SceneConfig();
config.buildFromProjectDir(projectRoot);
let scene = new Scene();
scene.buildSceneFromProjectDir(config);

const method = scene.getMethods().filter(
    (v) => v.getName() === 'U2')[0];

// 创建Checker
const problem = new UndefinedVariableChecker(
    [...method.getCfg()!.getBlocks()][0].getStmts()[method.getParameters().length],
    method
);

// Solver求解
const solver = new UndefinedVariableSolver(problem, scene);
solver.solve();

// 输出错误报告
for (const outcome of problem.getOutcomes()) {
    let position = outcome.stmt.getOriginPositionInfo();
    console.log('undefined error in line ' + position.getLineNo());
}
