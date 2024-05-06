import { SceneConfig } from "../../src/bundle";
import { Scene } from "../../src/bundle";
import { ArkBody } from "../../src/bundle";
import { StaticSingleAssignmentFormer } from "../../src/bundle";

export class Test {
    public buildScene(): Scene {
        const config_path = "ex\\resources\\ssa\\ssa.json";
        let config: SceneConfig = new SceneConfig();
        config.buildFromJson(config_path);
        return new Scene(config);
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

                    const body = arkMethod.getBody();
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
