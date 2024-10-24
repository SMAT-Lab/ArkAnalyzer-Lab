import { ClassSignature, Decorator, PrinterBuilder, Scene, SceneConfig, ViewTreePrinter } from 'arkanalyzer';
import { join } from 'path';

function decorators2str(decorators: Decorator[]): string {
    return decorators.map((value) => `@${value.getContent()}`).join(', ');
}

let config: SceneConfig = new SceneConfig();
config.buildFromJson(join(__dirname, '../resources/CountDown/arkanalyzer_config.json'));
let scene: Scene = new Scene();
scene.buildBasicInfo(config);
scene.buildScene4HarmonyProject();
scene.collectProjectImportInfos();
scene.inferTypes();

let arkFile = scene.getFiles().find((file) => file.getName().endsWith('CountDown.ets'));
let arkClass = arkFile?.getClassWithName('CountDown');
let vt = arkClass?.getViewTree();
let root = vt?.getRoot();
root?.walk((item) => {
    if (item.isCustomComponent() && item.signature instanceof ClassSignature && item.signature?.getClassName() === 'Clock') {
        let values: string[] = [];
        for (const [key, value] of item.stateValuesTransfer!) {
            values.push(`${decorators2str(value.getStateDecorators())} ${value.getName()} -> ${decorators2str(key.getStateDecorators())} ${key.getName()}`);
        }

        if (values.length > 0) {
            console.log(`CountDown->Clock transfer values\n ${values.join(',\n ')}`);
        } else {
            console.log(`CountDown->Clock no transfer values.`);
        }
    }
    
    return false;
});

PrinterBuilder.dump(new ViewTreePrinter(vt!), 'out/CountDownViewTree.dot');
