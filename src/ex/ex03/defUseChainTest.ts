import { SceneConfig, Scene } from 'arkanalyzer';

export class Test {
    public buildScene(): Scene {
        const projectRoot = 'src/ex/resources/defUseChain';
        let config: SceneConfig = new SceneConfig();
        config.buildFromProjectDir(projectRoot);
        let scene = new Scene();
        scene.buildSceneFromProjectDir(config);
        return scene;
    }

    public test() {
        let scene = this.buildScene();
        scene.inferTypes();

        let method = scene.getMethods().filter((v) => v.getName() === 'defUseChain')[0];

        const cfg = method.getBody()!.getCfg();
        cfg.buildDefUseChain();
        for (const chain of cfg.getDefUseChains()) {
            console.log(
                `variable: ${chain.value.toString()}, def: ${chain.def.toString()}, use: ${chain.use.toString()}`
            );
        }
    }

    public testTypeInference(): void {
        let scene = this.buildScene();
        scene.inferTypes();
    }
}

let t = new Test();
t.test();
