import { SceneConfig, Scene, MethodSignature, printCallGraphDetails } from "../../src/bundle";
import { printCallGraph } from "./callGraphUtils";

let config: SceneConfig = new SceneConfig()
config.buildFromJson("./ex/resources/callgraph/callGraphConfig.json");
function runScene(config: SceneConfig) {
    let projectScene: Scene = new Scene(config);
    let entryPoints: MethodSignature[] = []

    // 指定入口点函数
    for (let arkFile of projectScene.getFiles()) {
        if (arkFile.getName() === "main.ts") {
            for (let arkClass of arkFile.getClasses()) {
                if (arkClass.getName() === "_DEFAULT_ARK_CLASS") {
                    for (let arkMethod of arkClass.getMethods()) {
                        if (arkMethod.getName() === "main") {
                            entryPoints.push(arkMethod.getSignature())
                        }
                    }
                }
            }
        }
    }
    
    // 类型推导
    projectScene.inferTypes()

    // 构建方法调用图
    let callGraph = projectScene.makeCallGraphCHA(entryPoints)

    let methods = callGraph.getMethods()
    let calls = callGraph.getCalls()
    printCallGraph(methods, calls, config.getTargetProjectDirectory())
    
}
runScene(config);