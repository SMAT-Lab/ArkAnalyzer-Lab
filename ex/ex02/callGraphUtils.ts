import { MethodSignature } from "typescript";

export function printCallGraph(methods: Set<MethodSignature>, calls: Map<MethodSignature, MethodSignature[]>, rootDir: string): void {
    // 打印 Methods
    console.log("Call Graph:\n")
    console.log('\tMethods:');
    methods.forEach(method => {
        console.log(`\t\t${method}`);
    });

    // 打印 Calls
    console.log('\tCalls:');
    // 计算最长的method名称的长度，加上箭头和空格的长度
    const longestCallerLength = Array.from(calls.keys()).reduce((max, method) => Math.max(max, method.toString().length), 0);
    const arrow = '->';
    const spacesAfterArrow = '   ';
    const prefixLength = longestCallerLength + arrow.length + spacesAfterArrow.length;

    calls.forEach((calledMethods, method) => {
        // 对于每个调用源，只打印一次调用源和第一个目标方法
        const modifiedMethodName = `<${method}`;
        console.log(`\t\t${modifiedMethodName.padEnd(4)}   ${arrow}`);

        for (let i = 0; i < calledMethods.length; i++) {
            const modifiedCalledMethod = `\t\t<${calledMethods[i]}`;
            console.log(`\t\t${modifiedCalledMethod}`);
        }
        console.log("\n")
    });
}