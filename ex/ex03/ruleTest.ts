import { SceneConfig } from "../../src/bundle";
import { Scene } from "../../src/bundle";
import { ArkStaticInvokeExpr } from "../../src/bundle";


export class Test {
    public buildScene(): Scene {
        const config_path = "ex\\resources\\rule\\rule.json";
        let config: SceneConfig = new SceneConfig();
        config.buildFromJson(config_path);
        return new Scene(config);
    }

    public test() {
        let scene = this.buildScene();
        scene.inferTypes();

        for (const arkFile of scene.arkFiles) {
            for (const arkClass of arkFile.getClasses()) {
                for (const arkMethod of arkClass.getMethods()) {
                    if (arkMethod.getName() == '_DEFAULT_ARK_METHOD') {
                        continue;
                    }
                    const cfg = arkMethod.getCfg();
                    for (const stmt of cfg.getStmts()) {
                        if (stmt.getExprs().length > 0) {
                            const expr = stmt.getExprs()[0];
                            if (expr instanceof ArkStaticInvokeExpr && expr.getMethodSignature().getMethodSubSignature().getMethodName() == "exec") {
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
