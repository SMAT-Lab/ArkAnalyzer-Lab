import { SceneConfig, Scene } from "arkanalyzer";

export class Test {
    public buildScene(): Scene {
        const projectRoot = "ex/resources/defUseChain";
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
                    console.log('*** arkMethod: ', arkMethod.getName());

                    const cfg = arkMethod.getBody()!.getCfg();
                    cfg.buildDefUseChain();
                    for (const chain of cfg.getDefUseChains()){
                        console.log("variable: "+chain.value.toString()+", def: "+chain.def.toString()+", use: "+chain.use.toString());
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
