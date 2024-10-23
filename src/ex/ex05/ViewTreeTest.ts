import { PrinterBuilder, Scene, SceneConfig, ViewTreePrinter } from 'arkanalyzer';
import { join } from 'path';

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
    let values: string[] = [];
    for (const field of item.stateValues) {
        values.push(field.getName());
    }
    if (values.length > 0) {
        console.log(`${item.name} using stateValues ${values.join(',')}`);
    } else {
        console.log(`${item.name}`);
    }
    return false;
});

PrinterBuilder.dump(new ViewTreePrinter(vt!), 'out/CountDownViewTree.dot');
