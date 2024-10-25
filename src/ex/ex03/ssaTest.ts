import { Scene, SceneConfig, StaticSingleAssignmentFormer, ArkBody } from 'arkanalyzer';

export class Test {
    public buildScene(): Scene {
        const projectRoot = 'src/ex/resources/ssa';
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
        let method = scene.getMethods().filter((v) => v.getName() === 'ssa')[0];
        const body = method.getBody()!;
        console.log('*****before ssa');
        this.printStmts(body);
        console.log('*****after ssa');
        staticSingleAssignmentFormer.transformBody(body);
        this.printStmts(body);
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
