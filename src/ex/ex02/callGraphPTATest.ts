import {
    SceneConfig,
    Scene,
    MethodSignature,
    CallGraph,
    CallGraphBuilder,
    Pag,
    PointerAnalysisConfig,
    PointerAnalysis,
    Method,
} from 'arkanalyzer';
import { printCallGraph } from './callGraphUtils';

let config: SceneConfig = new SceneConfig();
config.buildFromProjectDir('src/ex/resources/callGraph');
function runScene(config: SceneConfig) {
    let projectScene: Scene = new Scene();
    projectScene.buildSceneFromProjectDir(config);
    // 类型推导
    projectScene.inferTypes();

    let entryPoints: MethodSignature[] = [];
    // 指定入口点函数
    for (const method of projectScene.getMethods()) {
        if (method.getName() === 'main' && method.getDeclaringArkFile().getName().endsWith('main.ts')) {
            entryPoints.push(method.getSignature());
        }
    }

    // 构建方法调用图
    let callGraph = new CallGraph(projectScene);
    let cgBuilder = new CallGraphBuilder(callGraph, projectScene);
    cgBuilder.buildDirectCallGraphForScene();

    let pag = new Pag();
    let entry = callGraph.getEntries();
    let ptaConfig = new PointerAnalysisConfig(2, './out', true, true);
    let pta = new PointerAnalysis(pag, callGraph, projectScene, ptaConfig);
    pta.setEntries(entry);

    pta.start();
    callGraph.dump('./out/PTA.dot');

    let methods = new Set<Method>();
    for (const entry of callGraph.getEntries()) {
        methods.add(callGraph.getMethodByFuncID(entry)!);
    }
    let calls = callGraph.getDynEdges();
    printCallGraph(methods, calls, config.getTargetProjectDirectory());
}
runScene(config);
