import { ArkField, ClassSignature, Decorator, PrinterBuilder, Scene, SceneConfig, ViewTreePrinter } from 'arkanalyzer';
import { join } from 'path';

function field2str(field: ArkField): string {
    let decorators = field
        .getStateDecorators()
        .map((value) => `@${value.getContent()}`)
        .join(', ');
    return `${decorators} ${field.getName()}`;
}

let config: SceneConfig = new SceneConfig();
config.buildFromJson(join(__dirname, '../resources/CountDown/arkanalyzer_config.json'));
let scene: Scene = new Scene();
scene.buildBasicInfo(config);
scene.buildScene4HarmonyProject();
scene.collectProjectImportInfos();
scene.inferTypes();

// 读取父组件CountDown ViewTree
let arkFile = scene.getFiles().find((file) => file.getName().endsWith('CountDown.ets'));
let arkClass = arkFile?.getClassWithName('CountDown');
let vt = arkClass?.getViewTree();
// 从根节点遍历UI组件，找到Clock组件并输出传递的状态变量
let root = vt?.getRoot();
root?.walk((item) => {
    // 自定义组件&&类名为Clock
    if (
        item.isCustomComponent() &&
        item.signature instanceof ClassSignature &&
        item.signature?.getClassName() === 'Clock'
    ) {
        let values: string[] = [];
        for (const [key, value] of item.stateValuesTransfer!) {
            values.push(`${field2str(value as ArkField)} -> ${field2str(key)}`);
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
