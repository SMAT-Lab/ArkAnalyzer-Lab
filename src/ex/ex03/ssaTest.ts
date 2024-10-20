import { Scene, SceneConfig, StaticSingleAssignmentFormer, ArkBody } from "arkanalyzer";

export class Test {
    public buildScene(): Scene {
        const projectRoot = "ex/resources/ssa";
        let config: SceneConfig = new SceneConfig();
        config.buildFromProjectDir(projectRoot);
        let scene = new Scene();
        scene.buildSceneFromProjectDir(config);
        return scene;
    }

    public test() {
        let scene = this.buildScene();
        scene.inferTypes();
        let staticSingleAssignmentFormer = new StaticSingleAssignmentFormer();
        for (const arkFile of scene.getFiles()) {
            console.log('=============== arkFile:', arkFile.getName(), ' ================');
            for (const arkClass of arkFile.getClasses()) {
                for (const arkMethod of arkClass.getMethods()) {
                    console.log('*** arkMethod: ', arkMethod.getName());

                    const body = arkMethod.getBody()!;
                    console.log("*****before ssa")
                    this.printStmts(body);
                    console.log("*****after ssa")
                    staticSingleAssignmentFormer.transformBody(body);
                    this.printStmts(body);
                }
            }
        }
    }

    public printStmts(body: ArkBody): void {
        console.log('-- threeAddresStmts:');
        let cfg = body.getCfg();
        for (const threeAddresStmt of cfg.getStmts()) {
            console.log(threeAddresStmt.toString());
        }
    }

}

let t = new Test();
t.test();
