import { SceneConfig, Scene, MethodSignature, Method } from 'arkanalyzer';
import { printCallGraph } from './callGraphUtils';

let config: SceneConfig = new SceneConfig();
config.buildFromProjectDir('src/ex/resources/callGraph');
function runScene(config: SceneConfig) {
    let projectScene: Scene = new Scene();
    projectScene.buildSceneFromProjectDir(config);
    
    let entryPoints: MethodSignature[] = [];
    // 指定入口点函数
    for (const method of projectScene.getMethods()) {
        if (method.getName() === 'main' && method.getDeclaringArkFile().getName().endsWith('main.ts')) {
            entryPoints.push(method.getSignature());
        }
    }

    // 类型推导
    projectScene.inferTypes();
    
    // 构建方法调用图
    let callGraph = projectScene.makeCallGraphCHA(entryPoints);
    callGraph.dump('./out/CHA.dot');

    let methods = new Set<Method>();
    for (const entry of callGraph.getEntries()) {
        methods.add(callGraph.getMethodByFuncID(entry)!);
    }
    let calls = callGraph.getDynEdges();
    printCallGraph(methods, calls, config.getTargetProjectDirectory());
}
runScene(config);
