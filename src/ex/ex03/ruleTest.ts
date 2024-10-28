import { SceneConfig, Scene, ArkStaticInvokeExpr } from 'arkanalyzer';

export class Test {
    public buildScene(): Scene {
        const projectRoot = 'src/ex/resources/rule';
        let config: SceneConfig = new SceneConfig();
        config.buildFromProjectDir(projectRoot);
        let scene = new Scene();
        scene.buildSceneFromProjectDir(config);
        return scene;
    }

    public test() {
        let scene = this.buildScene();
        scene.inferTypes();

        for (const arkFile of scene.getFiles()) {
            for (const arkClass of arkFile.getClasses()) {
                for (const arkMethod of arkClass.getMethods()) {
                    if (arkMethod.getName() == '_DEFAULT_ARK_METHOD') {
                        continue;
                    }
                    const cfg = arkMethod.getCfg()!;
                    for (const stmt of cfg.getStmts()) {
                        if (stmt.getExprs().length > 0) {
                            const expr = stmt.getExprs()[0];
                            if (
                                expr instanceof ArkStaticInvokeExpr &&
                                expr.getMethodSignature().getMethodSubSignature().getMethodName() == 'exec'
                            ) {
                                const args = expr.getArgs();
                                console.log(args);
                            }
                        }
                    }
                }
            }
        }
    }

    public testTypeInference(): void {
        let scene = this.buildScene();
        scene.inferTypes();
    }
}

let t = new Test();
t.test();
