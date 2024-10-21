import { SceneConfig, Scene, MethodSignature, Method } from 'arkanalyzer';
import { printCallGraph } from './callGraphUtils';

let config: SceneConfig = new SceneConfig();
config.buildFromProjectDir('src/ex/resources/callGraph');
function runScene(config: SceneConfig) {
    let projectScene: Scene = new Scene();
    projectScene.buildSceneFromProjectDir(config);
    let entryPoints: MethodSignature[] = [];

    // 指定入口点函数
    for (let arkFile of projectScene.getFiles()) {
        if (arkFile.getName() === 'main.ts') {
            for (let arkClass of arkFile.getClasses()) {
                if (arkClass.getName() === '_DEFAULT_ARK_CLASS') {
                    for (let arkMethod of arkClass.getMethods()) {
                        if (arkMethod.getName() === 'main') {
                            entryPoints.push(arkMethod.getSignature());
                        }
                    }
                }
            }
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
