import { SceneConfig } from "../../src/bundle";
import { Scene } from "../../src/bundle";
import { ModelUtils } from "../../src/bundle";
import { UndefinedVariableChecker, UndefinedVariableSolver } from "../../src/bundle";

const config_path = "ex\\resources\\UndefinedVariable\\UndefinedVariable.json";
let config: SceneConfig = new SceneConfig();
config.buildFromJson(config_path);
const scene = new Scene(config);
const classMap = scene.getClassMap();
const defaultMethod = scene.getFiles()[0].getDefaultClass().getDefaultArkMethod();
const method = ModelUtils.getMethodWithName("U2",defaultMethod!);
if(method){
    const problem = new UndefinedVariableChecker([...method.getCfg().getBlocks()][0].getStmts()[method.getParameters().length],method);
    const solver = new UndefinedVariableSolver(problem, scene);
    solver.solve();
    debugger
}
