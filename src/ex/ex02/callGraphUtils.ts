import { Method } from 'arkanalyzer';

export function printCallGraph(methods: Set<Method>, calls: Map<Method, Set<Method>>, rootDir: string): void {
    // 打印 Methods
    console.log('Call Graph:\n');
    console.log('\tMethods:');
    methods.forEach((method) => {
        console.log(`\t\t${method}`);
    });

    // 打印 Calls
    console.log('\tCalls:');
    const arrow = '->';
    calls.forEach((calledMethods, method) => {
        // 对于每个调用源，只打印一次调用源和第一个目标方法
        const modifiedMethodName = `<${method}`;
        console.log(`\t\t${modifiedMethodName.padEnd(4)}   ${arrow}`);

        for (const modifiedCalledMethod of calledMethods) {
            console.log(`\t\t\t\t<${modifiedCalledMethod}`);
        }
        console.log('\n');
    });
}
