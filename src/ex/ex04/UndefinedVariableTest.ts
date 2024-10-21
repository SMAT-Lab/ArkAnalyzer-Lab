import { Scene, SceneConfig, ModelUtils, UndefinedVariableChecker, UndefinedVariableSolver } from 'arkanalyzer';

const projectRoot = 'src/ex/resources/UndefinedVariable';
let config: SceneConfig = new SceneConfig();
config.buildFromProjectDir(projectRoot);
let scene = new Scene();
scene.buildSceneFromProjectDir(config);

const defaultMethod = scene.getFiles()[0].getDefaultClass().getDefaultArkMethod();
const method = ModelUtils.getMethodWithName('U2', defaultMethod!);
if (method) {
    const problem = new UndefinedVariableChecker(
        [...method.getCfg()!.getBlocks()][0].getStmts()[method.getParameters().length],
        method
    );
    const solver = new UndefinedVariableSolver(problem, scene);
    solver.solve();
}
